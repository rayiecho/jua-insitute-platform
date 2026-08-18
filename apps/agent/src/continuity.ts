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
  const memoryQuery = curriculumContext?.nodeContent ?? curriculumContext?.nodeTitle ?? null;
  const memories = await fetchRelevantMemories(learnerId, memoryQuery);

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
    parts.push(`Relevant long-term context:\n${memories.map((m) => `- ${m}`).join('\n')}`);
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

async function fetchRelevantMemories(learnerId: string, _queryText: string | null): Promise<string[]> {
  // TEMPORARILY DISABLED (2026-08-17): embedText() (apps/agent/src/embeddings.ts)
  // hung tutor sessions on session start TWICE in production, including after
  // adding a 4s Promise.race timeout around it — meaning the hang is very
  // likely a *synchronous* blocking call inside onnxruntime-node's native
  // model-init addon, which can starve the event loop badly enough that even
  // an independent setTimeout callback never gets a turn to fire. A JS-level
  // timeout can't protect against that; only real thread/process isolation
  // (e.g. running the model in a worker_thread) can. Reverted to the
  // recency-based fallback unconditionally until that's built and verified —
  // reliable live tutoring matters far more than semantic memory ranking.
  const { data } = await supabase
    .from('lesson_memory_vectors')
    .select('summary_text')
    .eq('user_id', learnerId)
    .order('created_at', { ascending: false })
    .limit(5);
  return (data ?? []).map((row) => row.summary_text);
}
