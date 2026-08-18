import { supabase } from './supabase.js';

export interface OpeningContext {
  systemPrompt: string;
  openingLine: string;
  preparedVideo: { title: string; url: string } | null;
}

// Section 4.4 — "Pick up where we left off". Runs once at session start,
// before the tutor speaks.
export async function buildOpeningContext(learnerId: string): Promise<OpeningContext> {
  const curriculumContext = await fetchCurrentCurriculumContext(learnerId);
  const memories = await fetchRecentSessionSummaries(learnerId);

  const parts: string[] = [
    'You are a 1-on-1 AI tutor picking up an ongoing relationship with this learner.',
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
    parts.push(
      'Be interactive: ask the learner questions throughout to check understanding, invite them to explain ideas back in their own words, and adjust pace based on how they respond. Avoid long uninterrupted monologues.',
    );
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
  };
}

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
async function fetchCurrentCurriculumContext(learnerId: string): Promise<CurrentCurriculumContext | null> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course_id, last_viewed_node_id, course:courses(title)')
    .eq('user_id', learnerId)
    .order('last_viewed_at', { ascending: false, nullsFirst: false })
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
