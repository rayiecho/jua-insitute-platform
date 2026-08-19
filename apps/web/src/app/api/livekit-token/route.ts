import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const AGENT_NAME = 'ai-tutor'; // must match ServerOptions.agentName in apps/agent/src/index.ts

// Mints a room-join token for the live tutoring session. Deliberately
// session-independent — live classes don't use the browser's auth cookie at
// all, by design (see TutorLobby): the learner types their first name and
// email every time, and identity is resolved from that against
// platform_users, not from a signed-in session. "Cannot have a live class
// if not enrolled" is still enforced — verification and enrollment happen
// once, at application time (lib/auth/provision.ts) — this just doesn't
// require the *browser* to still be carrying that session later.
//
// courseId is optional and only meaningful for a learner enrolled in more
// than one program — TutorLobby's program picker sends it so the tutor
// coaches on the program the learner actually means, instead of guessing
// from whichever they touched most recently (see resolveActiveNode).
export async function POST(request: Request) {
  const { firstName, email, courseId } = (await request.json()) as {
    firstName?: string;
    email?: string;
    courseId?: string;
  };
  if (!firstName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'firstName and email are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: learner } = await admin
    .from('platform_users')
    .select('id, first_name, last_name, email, email_verified')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (!learner || !learner.email_verified) {
    return NextResponse.json({ error: 'not_verified' }, { status: 403 });
  }

  const { data: enrollments } = await admin.from('enrollments').select('course_id').eq('user_id', learner.id);
  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ error: 'not_enrolled' }, { status: 403 });
  }
  // A client-supplied courseId that this learner isn't actually enrolled in
  // would let them impersonate progress in a program they never joined —
  // only honor it if it's really one of theirs, silently ignore otherwise.
  const validCourseId = courseId && enrollments.some((e) => e.course_id === courseId) ? courseId : undefined;

  const identity = learner.id;
  const room = `learner-${identity}`;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json({ error: 'LiveKit server env vars are not configured' }, { status: 500 });
  }

  const roomServiceClient = new RoomServiceClient(serverUrl, apiKey, apiSecret);

  // The avatar vendor (Simli) is only affordable at up to 2 concurrent
  // sessions on the current plan — every live class room gets a real,
  // billed avatar session, so this has to be a hard cap checked live
  // against LiveKit, not a soft admin-side estimate. Rejoining a room this
  // same learner is already in (a refresh, say) never counts against the
  // cap — only genuinely other concurrent classes do.
  const MAX_CONCURRENT_CLASSES = 2;
  const existingRooms = await roomServiceClient.listRooms();
  const otherActiveClasses = existingRooms.filter(
    (r) => r.name.startsWith('learner-') && r.name !== room && r.numParticipants > 0,
  );
  if (otherActiveClasses.length >= MAX_CONCURRENT_CLASSES) {
    return NextResponse.json({ error: 'class_capacity_full' }, { status: 429 });
  }

  const token = new AccessToken(apiKey, apiSecret, { identity, ttl: '15m' });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  // listDispatch 404s if the room doesn't exist yet (rooms are otherwise only
  // created implicitly when the first participant joins) — createRoom is a
  // no-op against an already-existing room, so this is safe to call every time.
  await roomServiceClient.createRoom({ name: room });

  const dispatchClient = new AgentDispatchClient(serverUrl, apiKey, apiSecret);
  const existingDispatches = await dispatchClient.listDispatch(room);
  if (!existingDispatches.some((d) => d.agentName === AGENT_NAME)) {
    // JSON-encoded so the agent (apps/agent/src/index.ts) can pull both the
    // learner id and, when given, which program this class is for.
    await dispatchClient.createDispatch(room, AGENT_NAME, {
      metadata: JSON.stringify({ learnerId: identity, courseId: validCourseId ?? null }),
    });
  }

  await ensureSessionCurriculumContext(room, identity, validCourseId);

  return NextResponse.json({
    token: await token.toJwt(),
    serverUrl,
    room,
    identity,
    firstName: learner.first_name,
    lastName: learner.last_name,
    email: learner.email,
  });
}

async function ensureSessionCurriculumContext(room: string, userId: string, courseId?: string) {
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
  const active = await resolveActiveNode(supabase, userId, courseId);
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
  courseId?: string,
): Promise<{ nodeId: string; assignmentId: string | null } | null> {
  // If the learner explicitly picked a program (multi-enrollment case),
  // honor that over guessing from recency. Otherwise fall back to whichever
  // enrollment they touched most recently (Section 4.4) — still far better
  // than the old "guess the first course" behavior.
  let enrollmentQuery = supabase.from('enrollments').select('course_id, last_viewed_node_id').eq('user_id', userId);
  enrollmentQuery = courseId
    ? enrollmentQuery.eq('course_id', courseId)
    : enrollmentQuery.order('last_viewed_at', { ascending: false, nullsFirst: false }).order('enrolled_at', { ascending: false });
  const { data: enrollment } = await enrollmentQuery.limit(1).maybeSingle();

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
