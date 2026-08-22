import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const AGENT_NAME = 'ai-tutor'; // must match ServerOptions.agentName in apps/agent/src/index.ts

// Mirrors the window in apps/web/src/app/api/learner-status/route.ts — a
// learner can only actually mint a token while their assigned class is
// joinable, not "whenever." Kept in sync deliberately rather than shared,
// since these are two small, independent route files.
const JOIN_WINDOW_BEFORE_MINUTES = 10;

// Mints a room-join token for a scheduled cohort class. Deliberately
// session-independent — live classes don't use the browser's auth cookie at
// all, by design (see TutorLobby): the learner types their first name and
// email every time, and identity is resolved from that against
// platform_users, not from a signed-in session. "Cannot have a live class
// if not enrolled" is still enforced — verification and enrollment happen
// once, at application time (lib/auth/provision.ts) — this just doesn't
// require the *browser* to still be carrying that session later.
//
// The room itself is now derived from whichever class_session the learner
// is assigned to and currently joinable for (see the resolution below), not
// a persistent one-per-learner room — several learners assigned to the same
// class_sessions row land in the same room. courseId is a client-supplied
// hint only used as a fallback if the learner somehow isn't resolvable to a
// joinable class; the real source of truth is joinable.course_id.
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

  // Scheduled cohort classes: a learner can only join whichever
  // class_session they've been assigned to, within a window around its
  // start time — mirrors the resolution in
  // apps/web/src/app/api/learner-status/route.ts, which is what TutorLobby
  // calls first to decide whether to show a join button at all. This is a
  // second, server-side check against the same rule (never trust the
  // client's "it's time" claim for something that mints a real room token).
  const now = new Date();
  const { data: assignments } = await admin
    .from('class_session_enrollments')
    .select('class_session:class_sessions(id, course_id, scheduled_start, duration_minutes, status)')
    .eq('user_id', learner.id);

  const joinable = (assignments ?? [])
    .map((a) => (Array.isArray(a.class_session) ? a.class_session[0] : a.class_session))
    .filter((s): s is NonNullable<typeof s> => !!s && s.status === 'scheduled')
    .find((s) => {
      const start = new Date(s.scheduled_start);
      const joinFrom = new Date(start.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60 * 1000);
      const joinUntil = new Date(start.getTime() + s.duration_minutes * 60 * 1000);
      return now >= joinFrom && now <= joinUntil;
    });

  if (!joinable) {
    return NextResponse.json({ error: 'no_class_ready' }, { status: 403 });
  }

  const classSessionId = joinable.id;
  const validCourseId = courseId ?? joinable.course_id;

  const identity = learner.id;
  const room = `class-${classSessionId}`;

  await admin
    .from('class_session_enrollments')
    .update({ joined_at: new Date().toISOString() })
    .eq('class_session_id', classSessionId)
    .eq('user_id', learner.id)
    .is('joined_at', null);

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json({ error: 'LiveKit server env vars are not configured' }, { status: 500 });
  }

  const roomServiceClient = new RoomServiceClient(serverUrl, apiKey, apiSecret);

  // Was capped at 2 for Simli's per-minute avatar cost — stale now that
  // Simli is disabled entirely (2026-08-22 infra review). The real
  // constraint today is LiveKit Cloud's free Build tier, which hard-caps at
  // 5 concurrent agent sessions platform-wide (verified against LiveKit's
  // docs) — Groq's Developer tier headroom comfortably covers 5 concurrent
  // classes' worth of token throughput, so LiveKit's cap is the binding one.
  // Rejoining a room this same learner is already in (a refresh, say) never
  // counts against the cap — only genuinely other concurrent classes do.
  const MAX_CONCURRENT_CLASSES = 5;
  const existingRooms = await roomServiceClient.listRooms();
  const otherActiveClasses = existingRooms.filter(
    (r) => r.name.startsWith('class-') && r.name !== room && r.numParticipants > 0,
  );
  if (otherActiveClasses.length >= MAX_CONCURRENT_CLASSES) {
    return NextResponse.json({ error: 'class_capacity_full' }, { status: 429 });
  }

  // name is required for classmates to see each other's actual names in a
  // group class — the token previously only carried identity (a raw
  // platform_users id), so a second learner's corner tile had nothing
  // readable to show.
  const token = new AccessToken(apiKey, apiSecret, { identity, name: learner.first_name, ttl: '15m' });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  // listDispatch 404s if the room doesn't exist yet (rooms are otherwise only
  // created implicitly when the first participant joins) — createRoom is a
  // no-op against an already-existing room, so this is safe to call every time.
  await roomServiceClient.createRoom({ name: room });

  const dispatchClient = new AgentDispatchClient(serverUrl, apiKey, apiSecret);
  const existingDispatches = await dispatchClient.listDispatch(room);
  if (!existingDispatches.some((d) => d.agentName === AGENT_NAME)) {
    // JSON-encoded so the agent (apps/agent/src/index.ts) knows this is a
    // scheduled cohort class and fetches everyone assigned to it, rather
    // than the old single learnerId shape.
    await dispatchClient.createDispatch(room, AGENT_NAME, {
      metadata: JSON.stringify({ classSessionId }),
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

  // A class_sessions room is one-off, not persistent, but several learners
  // can share it — this still inserts one context row per (session, user)
  // pair so each learner's own active lesson/assignment is tracked
  // separately even though they're all in the same room.
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
