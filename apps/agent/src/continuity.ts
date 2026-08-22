import { supabase } from './supabase.js';

export interface OpeningContext {
  systemPrompt: string;
  openingLine: string;
  preparedVideo: { title: string; url: string } | null;
  // Lets index.ts decide which teaching-screen tools to even offer the
  // model — confirmed live 2026-08-19: with showCode available in every
  // course, the tutor wrote a Python pandas demo mid-Entrepreneurship-class
  // as an "illustration." Restricting the tool to programming courses is
  // more reliable than trusting the prompt alone to talk it out of that.
  courseTitle: string | null;
}

// Section 4.4 — "Pick up where we left off". Runs once at session start,
// before the tutor speaks.
export async function buildOpeningContext(learnerId: string, courseId?: string): Promise<OpeningContext> {
  const curriculumContext = await fetchCurrentCurriculumContext(learnerId, courseId);
  const memories = await fetchRecentSessionSummaries(learnerId);

  const parts: string[] = [
    'Your name is Jua. You are a 1-on-1 AI tutor at Jua Institute, picking up an ongoing relationship with this learner. If asked what model, AI, or company you\'re built on, say you\'re Jua Institute\'s own tutor — never mention ChatGPT, OpenAI, GPT, Groq, Deepgram, or any other underlying vendor or model name, even if asked directly.',
  ];
  if (curriculumContext?.courseTitle) {
    parts.push(
      `The learner is enrolled in the "${curriculumContext.courseTitle}" program. Coach them on this program only — do not teach unrelated topics.`,
    );
  }
  if (curriculumContext?.weekTitle) {
    parts.push(
      `This live session covers Week ${curriculumContext.weekNumber}: "${curriculumContext.weekTitle}" (roughly a ${curriculumContext.sessionDurationMinutes ?? 90}-minute session).\n\nWeek summary: ${curriculumContext.weekSummary ?? ''}`,
    );
    if (curriculumContext.weekLessonTitles.length > 0) {
      parts.push(
        `This week's self-paced portal lessons cover: ${curriculumContext.weekLessonTitles.join('; ')}. Don't just recite these — your job in this live session is to teach the underlying CONCEPTS behind the week through discussion, at a level that makes sense given where the learner actually is, not to read the portal content aloud.`,
      );
    }
    parts.push(ENGAGEMENT_INSTRUCTIONS);
  }
  if (curriculumContext?.nodeContent) {
    parts.push(
      `They're specifically up to "${curriculumContext.nodeTitle}" in the portal right now — here's that lesson's material for your reference, teach from its ideas in your own spoken words rather than reading it verbatim:\n\n${curriculumContext.nodeContent}`,
    );
  } else if (curriculumContext?.nodeTitle) {
    parts.push(`The learner's current curriculum lesson is "${curriculumContext.nodeTitle}".`);
  }
  if (curriculumContext?.assignmentInstructions) {
    parts.push(
      `The learner's current assignment, "${curriculumContext.assignmentTitle}":\n\n${curriculumContext.assignmentInstructions}`,
    );
  } else if (curriculumContext?.assignmentTitle) {
    parts.push(`They're also working on the assignment "${curriculumContext.assignmentTitle}".`);
  }
  if (curriculumContext?.nodeTitle || curriculumContext?.assignmentTitle) {
    parts.push('Stay with this week\'s material unless the learner explicitly asks to move on.');
  }
  if (curriculumContext?.videoUrl) {
    parts.push(
      `A short video for this lesson is prepared and will be shared in the room automatically. Mention early in the session that you've prepared a video on this topic and that they can watch it in the session guide panel.`,
    );
  }
  if (memories.length > 0) {
    parts.push(
      `What actually happened in your last live sessions with this learner, most recent first:\n${memories.map((m) => `- ${m}`).join('\n')}\n\nOpen by referencing something SPECIFIC from this — not a generic "welcome back" — so the learner can tell you genuinely remember the conversation, not just their curriculum position.`,
    );
  }
  parts.push(TEACHING_SCREEN_INSTRUCTIONS);
  parts.push(UNDERSTANDING_INSTRUCTIONS);

  parts.push(
    curriculumContext?.nodeTitle
      ? 'Open the session by briefly acknowledging where the learner left off — do not greet them as a stranger.'
      : "The learner hasn't started a program yet — welcome them and ask what they'd like to focus on.",
  );

  return {
    systemPrompt: parts.join('\n\n'),
    openingLine: curriculumContext?.nodeTitle
      ? `Welcome the learner and confirm you're picking up with "${curriculumContext.nodeTitle}".`
      : 'Welcome the learner and ask what they would like to focus on first.',
    preparedVideo:
      curriculumContext?.videoUrl && curriculumContext.nodeTitle
        ? { title: curriculumContext.nodeTitle, url: curriculumContext.videoUrl }
        : null,
    courseTitle: curriculumContext?.courseTitle ?? null,
  };
}

// Shared by both the 1-on-1 and group opening contexts — the teaching
// screen (apps/agent/src/teaching-screen.ts) is available in every live
// class regardless of format.
const TEACHING_SCREEN_INSTRUCTIONS =
  'You have a shared teaching screen visible to the learner(s), like screen-sharing in a live call. When walking through Python code, call showCode with the real code (set run:true to actually execute it and show real output, like live coding in VS Code) instead of just describing it verbally. When introducing or summarizing a non-code concept, call showSlide with a short title and a few concrete points, like presenting a slide. ' +
  'Call at most ONE of these per spoken turn, and only when you are genuinely moving to a new topic — never call it more than once in a row before actually speaking, and never call it again seconds later. ' +
  'The screen is a visual aid, not your script: never say out loud that you are "showing a slide" or announce the tool itself, and never just read the slide\'s points aloud verbatim — talk through the idea in your own words, with more depth, examples, and back-and-forth than the few short points on screen, the way a real teacher elaborates on a slide instead of reciting it.';

// Confirmed live 2026-08-19: the tutor was talking for long uninterrupted
// stretches and the learner's attention drifted — the previous one-line
// "be interactive" instruction wasn't concrete enough to actually change
// behavior. This gives it a hard cadence to follow instead of a vague ideal.
const ENGAGEMENT_INSTRUCTIONS =
  'Never speak for more than about 30-45 seconds (roughly 2-3 short spoken paragraphs) without stopping to involve the learner — ask a direct question, have them predict what happens next, or have them explain something back in their own words, then wait for a real answer before continuing. Do not lecture in one long monologue and check in only at the end; check in constantly, mid-explanation. If the learner gives a short or passive reply ("ok", "yeah"), follow up with something that requires them to actually think and respond, not just acknowledge.';

const GROUP_ENGAGEMENT_INSTRUCTIONS =
  'Never speak for more than about 30-45 seconds without stopping to involve the group — ask a direct question and call on a specific learner by name to answer, or have someone explain an idea back in their own words, then wait for a real answer before continuing. Rotate who you call on so it is not always the same person. Do not lecture in one long monologue and check in only at the end; check in constantly, mid-explanation.';

// "Make it have sense, not generic — some real understanding." A canned
// definition-then-example script reads as generic regardless of how the
// content is delivered; this asks for actual pedagogical judgment based on
// what the learner specifically says, not a fixed lesson script.
const UNDERSTANDING_INSTRUCTIONS =
  "Actually diagnose what the learner understands rather than running through a fixed script. When they answer or ask something, respond to the SPECIFIC thing they said — reference their actual words or idea directly, don't give a generic restatement of the concept as if they hadn't spoken. If their answer reveals a specific misconception, name that exact misconception and correct it directly, rather than just repeating the definition from the top. If they clearly already understand something, don't re-explain it — move forward. Prefer explaining WHY something works the way it does, with a concrete real-world example (a real small business scenario, a real piece of code's actual behavior), over reciting a dictionary-style definition. Treat this as a real, ongoing teaching relationship with this specific person, not a generic lesson being read to whoever happens to be listening.";

interface CurrentCurriculumContext {
  courseTitle: string | null;
  weekNumber: number | null;
  weekTitle: string | null;
  weekSummary: string | null;
  weekLessonTitles: string[];
  sessionDurationMinutes: number | null;
  nodeTitle: string | null;
  nodeContent: string | null;
  videoUrl: string | null;
  assignmentTitle: string | null;
  assignmentInstructions: string | null;
}

// Derived FRESH from the learner's actual enrollment every call — mirrors
// resolveActiveNode in apps/web/src/app/api/livekit-token/route.ts, rather
// than reading session_curriculum_context's historical "most recent row"
// (the previous approach). That history table only ever gets a new row
// when a learner is enrolled; for anyone without a current enrollment it
// writes nothing, which meant the "most recent row ever" could silently be
// a stale row from an entirely different course — confirmed live
// 2026-08-17, where the tutor referenced "Variables and Types" (a
// pre-enrollment-era Python demo row) for a learner who was actually
// enrolled in and working through Entrepreneurship. Computing this fresh
// each time makes that class of bug structurally impossible: there's no
// history to go stale.
async function fetchCurrentCurriculumContext(
  learnerId: string,
  courseId?: string,
): Promise<CurrentCurriculumContext | null> {
  // A learner enrolled in more than one program picks which one this class
  // is for at join time (TutorLobby's program picker) — honor that over
  // guessing from recency, mirroring resolveActiveNode in
  // apps/web/src/app/api/livekit-token/route.ts.
  let enrollmentQuery = supabase
    .from('enrollments')
    .select('course_id, last_viewed_node_id, course:courses(title)')
    .eq('user_id', learnerId);
  enrollmentQuery = courseId
    ? enrollmentQuery.eq('course_id', courseId)
    : enrollmentQuery.order('last_viewed_at', { ascending: false, nullsFirst: false }).order('enrolled_at', { ascending: false });
  const { data: enrollment } = await enrollmentQuery.limit(1).maybeSingle();

  if (!enrollment) return null; // not enrolled in anything — nothing to teach from
  const course = Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course;
  const courseTitle = course?.title ?? null;

  let node: { title: string; markdown_content: string; video_url: string | null; week_id: string | null } | null =
    null;
  let assignmentTitle: string | null = null;
  let assignmentInstructions: string | null = null;

  // Prefer an assignment actually in progress within THIS course.
  const { data: inProgressRows } = await supabase
    .from('student_assignments_progress')
    .select(
      'assignment:course_assignments(title, instructions_markdown, node:curriculum_nodes(title, markdown_content, video_url, week_id, course_id))',
    )
    .eq('user_id', learnerId)
    .eq('grading_status', 'in_progress')
    .order('updated_at', { ascending: false });

  for (const row of inProgressRows ?? []) {
    const assignment = Array.isArray(row.assignment) ? row.assignment[0] : row.assignment;
    const candidateNode = Array.isArray(assignment?.node) ? assignment.node[0] : assignment?.node;
    if (candidateNode?.course_id === enrollment.course_id) {
      node = candidateNode;
      assignmentTitle = assignment?.title ?? null;
      assignmentInstructions = assignment?.instructions_markdown ?? null;
      break;
    }
  }

  // Otherwise, wherever they last read within this program.
  if (!node && enrollment.last_viewed_node_id) {
    const { data: lastViewed } = await supabase
      .from('curriculum_nodes')
      .select('title, markdown_content, video_url, week_id')
      .eq('id', enrollment.last_viewed_node_id)
      .maybeSingle();
    node = lastViewed ?? null;
  }

  // Enrolled but haven't opened a lesson yet — start of the program.
  if (!node) {
    const { data: firstNode } = await supabase
      .from('curriculum_nodes')
      .select('title, markdown_content, video_url, week_id')
      .eq('course_id', enrollment.course_id)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    node = firstNode ?? null;
  }

  if (!node) {
    return { courseTitle, weekNumber: null, weekTitle: null, weekSummary: null, weekLessonTitles: [], sessionDurationMinutes: null, nodeTitle: null, nodeContent: null, videoUrl: null, assignmentTitle: null, assignmentInstructions: null };
  }

  // The week is what the live session actually teaches (Section — "2 live
  // sessions/week covering that week's concepts"), not just the one lesson
  // the learner happens to have open — pulling the whole week's outline
  // lets the tutor teach concepts across it instead of narrating one lesson.
  let weekNumber: number | null = null;
  let weekTitle: string | null = null;
  let weekSummary: string | null = null;
  let weekLessonTitles: string[] = [];
  let sessionDurationMinutes: number | null = null;

  if (node.week_id) {
    const { data: week } = await supabase
      .from('course_weeks')
      .select('week_number, title, summary, live_session_duration_minutes')
      .eq('id', node.week_id)
      .maybeSingle();
    if (week) {
      weekNumber = week.week_number;
      weekTitle = week.title;
      weekSummary = week.summary;
      sessionDurationMinutes = week.live_session_duration_minutes;
    }

    const { data: weekNodes } = await supabase
      .from('curriculum_nodes')
      .select('title')
      .eq('week_id', node.week_id)
      .order('sequence_order', { ascending: true });
    weekLessonTitles = (weekNodes ?? []).map((n) => n.title);
  }

  return {
    courseTitle,
    weekNumber,
    weekTitle,
    weekSummary,
    weekLessonTitles,
    sessionDurationMinutes,
    nodeTitle: node.title,
    nodeContent: node.markdown_content,
    videoUrl: node.video_url,
    assignmentTitle,
    assignmentInstructions,
  };
}

// Scheduled cohort classes: several learners share one class_sessions row
// and one LiveKit room (`class-${classSessionId}`, minted by
// apps/web/src/app/api/livekit-token/route.ts). Unlike the old
// one-room-per-learner model, curriculum context here comes straight from
// the class_sessions/course_weeks row the admin scheduled — there's no
// per-learner recency guess to make, everyone in the room is here for the
// same week. Per-learner history (conversation_summaries) still isn't
// meaningful across DISTINCT scheduled classes (each class_sessions row is
// a one-off event, not a recurring room), so this only looks for summaries
// tied to this exact room — relevant on a reconnect mid-class, not "last
// week's class."
export async function buildGroupOpeningContext(classSessionId: string): Promise<OpeningContext> {
  const room = `class-${classSessionId}`;

  const { data: session } = await supabase
    .from('class_sessions')
    .select('course_id, week_id, duration_minutes, course:courses(title)')
    .eq('id', classSessionId)
    .maybeSingle();

  const course = session ? (Array.isArray(session.course) ? session.course[0] : session.course) : null;
  const courseTitle = course?.title ?? null;

  const { data: enrollmentRows } = await supabase
    .from('class_session_enrollments')
    .select('learner:platform_users(first_name, last_name)')
    .eq('class_session_id', classSessionId);
  const learnerNames = (enrollmentRows ?? [])
    .map((r) => (Array.isArray(r.learner) ? r.learner[0] : r.learner))
    .filter((l): l is { first_name: string; last_name: string } => !!l)
    .map((l) => l.first_name);

  let weekNumber: number | null = null;
  let weekTitle: string | null = null;
  let weekSummary: string | null = null;
  let weekLessonTitles: string[] = [];

  if (session?.week_id) {
    const { data: week } = await supabase
      .from('course_weeks')
      .select('week_number, title, summary')
      .eq('id', session.week_id)
      .maybeSingle();
    if (week) {
      weekNumber = week.week_number;
      weekTitle = week.title;
      weekSummary = week.summary;
    }
    const { data: weekNodes } = await supabase
      .from('curriculum_nodes')
      .select('title')
      .eq('week_id', session.week_id)
      .order('sequence_order', { ascending: true });
    weekLessonTitles = (weekNodes ?? []).map((n) => n.title);
  }

  const memories = await fetchRecentSessionSummariesByRoom(room);

  const parts: string[] = [
    "Your name is Jua. If asked what model, AI, or company you're built on, say you're Jua Institute's own tutor — never mention ChatGPT, OpenAI, GPT, Groq, Deepgram, or any other underlying vendor or model name, even if asked directly.",
    learnerNames.length > 1
      ? `You are an AI tutor teaching a live group class to ${learnerNames.length} learners: ${learnerNames.join(', ')}. Address them by name, involve everyone, and don't let the conversation become 1-on-1 with whoever is most talkative.`
      : 'You are an AI tutor teaching a live class.',
  ];
  if (courseTitle) {
    parts.push(`This class is for the "${courseTitle}" program. Coach on this program only.`);
  }
  if (weekTitle) {
    parts.push(
      `This session covers Week ${weekNumber}: "${weekTitle}" (roughly a ${session?.duration_minutes ?? 45}-minute session).\n\nWeek summary: ${weekSummary ?? ''}`,
    );
    if (weekLessonTitles.length > 0) {
      parts.push(
        `This week's self-paced portal lessons cover: ${weekLessonTitles.join('; ')}. Teach the underlying CONCEPTS behind the week through discussion, at a level that works for the whole group, not a read-aloud of the portal content.`,
      );
    }
    parts.push(GROUP_ENGAGEMENT_INSTRUCTIONS);
  }
  if (memories.length > 0) {
    parts.push(
      `Earlier in this same class session, before a reconnect:\n${memories.map((m) => `- ${m}`).join('\n')}\n\nPick back up from there rather than restarting.`,
    );
  }
  parts.push(TEACHING_SCREEN_INSTRUCTIONS);
  parts.push(UNDERSTANDING_INSTRUCTIONS);

  parts.push(
    weekTitle
      ? `Open the session by welcoming everyone by name and briefly framing Week ${weekNumber}: "${weekTitle}".`
      : 'Open the session by welcoming everyone by name and asking what they would like to focus on.',
  );

  return {
    systemPrompt: parts.join('\n\n'),
    openingLine: weekTitle
      ? `Welcome the group by name and introduce Week ${weekNumber}: "${weekTitle}".`
      : 'Welcome the group by name and ask what they would like to focus on first.',
    preparedVideo: null,
    courseTitle,
  };
}

async function fetchRecentSessionSummariesByRoom(room: string): Promise<string[]> {
  const { data: sessionRow } = await supabase
    .from('classroom_sessions')
    .select('id')
    .eq('room_name', room)
    .maybeSingle();

  if (!sessionRow) return [];

  const { data } = await supabase
    .from('conversation_summaries')
    .select('summary_text')
    .eq('session_id', sessionRow.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (data ?? []).map((row) => row.summary_text);
}

// Real cross-session memory, without the disabled embedding pipeline.
// lesson_memory_vectors (semantic search) is intentionally not written to
// right now (see compaction.ts's matching note — embedText() hung
// production twice via a synchronous onnxruntime-node call) so reading from
// it, as this used to, returned an empty table in practice: infrastructure
// that looked real but had nothing behind it.
//
// conversation_summaries is different — CompactionManager genuinely writes
// to it mid-session once a live class's conversation crosses ~3000
// estimated tokens (compaction.ts). Since a learner's LiveKit room is
// persistent and one-per-learner (`learner-${learnerId}`, see
// apps/web/src/app/api/livekit-token/route.ts), classroom_sessions has (at
// most) one row per learner, and every summary from every past class they've
// had links to it — reading the most recent ones is a genuine "what did we
// actually talk about last time," not a recency-only stand-in.
//
// Caveat: a class that ends before crossing the token threshold produces no
// summary at all — this only has something to say once at least one class
// has run long enough to compact. That's expected to be the normal case at
// the current 45-minute class length, not the exception.
async function fetchRecentSessionSummaries(learnerId: string): Promise<string[]> {
  const { data: sessionRow } = await supabase
    .from('classroom_sessions')
    .select('id')
    .eq('room_name', `learner-${learnerId}`)
    .maybeSingle();

  if (!sessionRow) return [];

  const { data } = await supabase
    .from('conversation_summaries')
    .select('summary_text')
    .eq('session_id', sessionRow.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (data ?? []).map((row) => row.summary_text);
}
