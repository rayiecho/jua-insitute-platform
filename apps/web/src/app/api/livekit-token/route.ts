import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
// TODO(Phase 2+): once auth exists, derive `identity` from the authenticated
// platform_users row instead of accepting it from the client, and validate
// the learner is actually allowed into `room` (their own scheduled session).
// At that point dispatch/session creation likely moves to a real booking flow
// instead of happening lazily here.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get('room');
  const identity = searchParams.get('identity');

  if (!room || !identity) {
    return NextResponse.json({ error: 'room and identity query params are required' }, { status: 400 });
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

  const { data: existingContext } = await supabase
    .from('session_curriculum_context')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existingContext) return; // already linked — don't duplicate on repeat joins

  const active = await resolveActiveNode(supabase, userId);
  if (!active) return; // no curriculum seeded yet — nothing to link

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
  const { data: inProgress } = await supabase
    .from('student_assignments_progress')
    .select('assignment_id, assignment:course_assignments(node_id)')
    .eq('user_id', userId)
    .eq('grading_status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const assignment = Array.isArray(inProgress?.assignment) ? inProgress.assignment[0] : inProgress?.assignment;
  if (assignment?.node_id) {
    return { nodeId: assignment.node_id, assignmentId: inProgress!.assignment_id };
  }

  // Fall back to the first node of the (MVP: single) course.
  const { data: firstNode } = await supabase
    .from('curriculum_nodes')
    .select('id')
    .order('sequence_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstNode ? { nodeId: firstNode.id, assignmentId: null } : null;
}
