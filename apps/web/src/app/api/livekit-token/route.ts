import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const AGENT_NAME = 'ai-tutor'; // must match ServerOptions.agentName in apps/agent/src/index.ts

// Mints a room-join token for the live tutoring session. This is a server
// Route Handler so LIVEKIT_API_SECRET never reaches the client.
//
// The agent worker registers under a named agent (`ai-tutor`), which means
// LiveKit will NOT auto-dispatch it into a room just because a participant
// joined — an explicit dispatch is required. We create one here (idempotent:
// skipped if a dispatch already exists for this room) so joining the room
// from the web client actually gets you a tutor.
//
// Also ensures a classroom_sessions + session_curriculum_context row exist
// for this room/learner (Section 4.4 continuity) so the agent's opening
// context query has real data instead of coming up empty.
//
// Identity comes from the real auth session now, not a client-supplied query
// param — previously any caller could pass any learnerId and mint a token
// impersonating them. `room` is still client-supplied but must match this
// learner's own room, so a signed-in learner can't request a token for
// someone else's room either.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get('room');

  if (!room) {
    return NextResponse.json({ error: 'room query param is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }
  if (room !== `learner-${user.id}`) {
    return NextResponse.json({ error: 'cannot request a token for another learner\'s room' }, { status: 403 });
  }

  const identity = user.id;

  const admin = createAdminClient();
  const { data: anyEnrollment } = await admin.from('enrollments').select('id').eq('user_id', identity).limit(1);
  if (!anyEnrollment || anyEnrollment.length === 0) {
    return NextResponse.json({ error: 'not enrolled in a program yet' }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json({ error: 'LiveKit server env vars are not configured' }, { status: 500 });
  }

  const token = new AccessToken(apiKey, apiSecret, { identity, ttl: '15m' });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  // listDispatch 404s if the room doesn't exist yet (rooms are otherwise only
  // created implicitly when the first participant joins) — createRoom is a
  // no-op against an already-existing room, so this is safe to call every time.
  const roomServiceClient = new RoomServiceClient(serverUrl, apiKey, apiSecret);
  await roomServiceClient.createRoom({ name: room });

  const dispatchClient = new AgentDispatchClient(serverUrl, apiKey, apiSecret);
  const existingDispatches = await dispatchClient.listDispatch(room);
  if (!existingDispatches.some((d) => d.agentName === AGENT_NAME)) {
    await dispatchClient.createDispatch(room, AGENT_NAME, { metadata: identity });
  }

  await ensureSessionCurriculumContext(room, identity);

  return NextResponse.json({ token: await token.toJwt(), serverUrl, room, identity });
}

async function ensureSessionCurriculumContext(room: string, userId: string) {
  const supabase = createAdminClient();

  let { data: session } = await supabase
    .from('classroom_sessions')
    .select('id')
    .eq('room_name', room)
    .maybeSingle();

  if (!session) {
    const { data: voice } = await supabase.from('voice_profiles').select('id').limit(1).maybeSingle();
    if (!voice) return; // no voice profile seeded yet — nothing sensible to link

    const { data: created } = await supabase
      .from('classroom_sessions')
      .insert({
        room_name: room,
        max_students: 1,
        current_status: 'pending',
        active_voice_id: voice.id,
        scheduled_start: new Date().toISOString(),
      })
      .select('id')
      .single();
    session = created;
  }
  if (!session) return;

  // Room is one-per-learner and persistent (see apps/web/src/app/tutor/page.tsx),
  // so a session/user pair repeats on every visit — we deliberately insert a
  // fresh row each join rather than dedupe, so continuity reflects wherever
  // the learner actually is *now*, not wherever they were on their first-ever
  // tutor visit. continuity.ts already reads the most recent row by
  // created_at, so older rows are just harmless history.
  const active = await resolveActiveNode(supabase, userId);
  if (!active) return; // not enrolled in a program yet — nothing to link

  await supabase.from('session_curriculum_context').insert({
    session_id: session.id,
    user_id: userId,
    active_node_id: active.nodeId,
    active_assignment_id: active.assignmentId,
  });
}

async function resolveActiveNode(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ nodeId: string; assignmentId: string | null } | null> {
  // The learner's most recently touched enrollment decides which PROGRAM the
  // tutor coaches on (Section 4.4) — no more guessing "the first course".
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course_id, last_viewed_node_id')
    .eq('user_id', userId)
    .order('last_viewed_at', { ascending: false, nullsFirst: false })
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment) return null; // hasn't enrolled in anything yet

  // Within that program, prefer an assignment actually in progress.
  const { data: inProgressRows } = await supabase
    .from('student_assignments_progress')
    .select('assignment_id, assignment:course_assignments(node_id, node:curriculum_nodes(course_id))')
    .eq('user_id', userId)
    .eq('grading_status', 'in_progress')
    .order('updated_at', { ascending: false });

  for (const row of inProgressRows ?? []) {
    const assignment = Array.isArray(row.assignment) ? row.assignment[0] : row.assignment;
    const node = Array.isArray(assignment?.node) ? assignment.node[0] : assignment?.node;
    if (assignment?.node_id && node?.course_id === enrollment.course_id) {
      return { nodeId: assignment.node_id, assignmentId: row.assignment_id };
    }
  }

  // Otherwise, wherever they last read within this program.
  if (enrollment.last_viewed_node_id) {
    return { nodeId: enrollment.last_viewed_node_id, assignmentId: null };
  }

  // Enrolled but haven't opened a lesson yet — start of the program.
  const { data: firstNode } = await supabase
    .from('curriculum_nodes')
    .select('id')
    .eq('course_id', enrollment.course_id)
    .order('sequence_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstNode ? { nodeId: firstNode.id, assignmentId: null } : null;
}
