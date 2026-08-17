import { supabase } from './supabase.js';
import { embedText } from './embeddings.js';

export interface OpeningContext {
  systemPrompt: string;
  openingLine: string;
}

// Section 4.4 — "Pick up where we left off". Runs once at session start, before
// the tutor speaks. Memory search needs to know the current lesson first (it
// searches *against* that), so curriculum context is fetched before it rather
// than in the same parallel batch as the other two, independent, queries.
export async function buildOpeningContext(learnerId: string): Promise<OpeningContext> {
  const curriculumContext = await fetchCurrentCurriculumContext(learnerId);
  const memoryQuery = curriculumContext?.nodeContent ?? curriculumContext?.nodeTitle ?? null;

  const [progress, memories] = await Promise.all([
    fetchInProgressAssignment(learnerId),
    fetchRelevantMemories(learnerId, memoryQuery),
  ]);

  const parts: string[] = [
    'You are a 1-on-1 AI tutor picking up an ongoing relationship with this learner.',
  ];
  if (curriculumContext?.sessionSummary) {
    parts.push(`Last session summary: ${curriculumContext.sessionSummary}`);
  }
  if (curriculumContext?.courseTitle) {
    parts.push(
      `The learner is enrolled in the "${curriculumContext.courseTitle}" program. Coach them on this program only — do not teach unrelated topics.`,
    );
  }
  if (curriculumContext?.nodeContent) {
    parts.push(
      `Lesson material for "${curriculumContext.nodeTitle}" — this is the learner's actual curriculum on the platform. Teach directly from it, in your own spoken words, rather than substituting your own general knowledge of the topic:\n\n${curriculumContext.nodeContent}`,
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
    parts.push('Stay with this lesson unless the learner explicitly asks to move on.');
  }
  if (progress) {
    parts.push(
      `Current assignment in progress: "${progress.title}" (status: ${progress.grading_status}).`,
    );
  }
  if (memories.length > 0) {
    parts.push(`Relevant long-term context:\n${memories.map((m) => `- ${m}`).join('\n')}`);
  }
  parts.push(
    'Open the session by briefly acknowledging where the learner left off — do not greet them as a stranger.',
  );

  return {
    systemPrompt: parts.join('\n\n'),
    openingLine: curriculumContext?.sessionSummary
      ? 'Welcome the learner back and reference what they were working on last time.'
      : curriculumContext?.nodeTitle
        ? `Welcome the learner and confirm you're picking up with "${curriculumContext.nodeTitle}".`
        : 'Welcome the learner and ask what they would like to focus on first.',
  };
}

async function fetchInProgressAssignment(learnerId: string) {
  const { data } = await supabase
    .from('student_assignments_progress')
    .select('grading_status, assignment:course_assignments(title)')
    .eq('user_id', learnerId)
    .eq('grading_status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const assignment = Array.isArray(data.assignment) ? data.assignment[0] : data.assignment;
  return { title: assignment?.title ?? 'untitled assignment', grading_status: data.grading_status };
}

interface CurrentCurriculumContext {
  sessionSummary: string | null;
  courseTitle: string | null;
  nodeTitle: string | null;
  nodeContent: string | null;
  assignmentTitle: string | null;
  assignmentInstructions: string | null;
}

async function fetchCurrentCurriculumContext(learnerId: string): Promise<CurrentCurriculumContext | null> {
  const { data } = await supabase
    .from('session_curriculum_context')
    .select(
      'session_summary, node:curriculum_nodes!active_node_id(title, markdown_content, course:courses(title)), assignment:course_assignments!active_assignment_id(title, instructions_markdown)',
    )
    .eq('user_id', learnerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const node = Array.isArray(data.node) ? data.node[0] : data.node;
  const course = Array.isArray(node?.course) ? node.course[0] : node?.course;
  const assignment = Array.isArray(data.assignment) ? data.assignment[0] : data.assignment;
  return {
    sessionSummary: data.session_summary ?? null,
    courseTitle: course?.title ?? null,
    nodeTitle: node?.title ?? null,
    nodeContent: node?.markdown_content ?? null,
    assignmentTitle: assignment?.title ?? null,
    assignmentInstructions: assignment?.instructions_markdown ?? null,
  };
}

async function fetchRelevantMemories(learnerId: string, queryText: string | null): Promise<string[]> {
  // No curriculum context yet (learner hasn't enrolled/opened a lesson) —
  // nothing sensible to search against, so just surface the most recent.
  if (!queryText) {
    const { data } = await supabase
      .from('lesson_memory_vectors')
      .select('summary_text')
      .eq('user_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(5);
    return (data ?? []).map((row) => row.summary_text);
  }

  try {
    const queryEmbedding = await embedText(queryText);
    const { data, error } = await supabase.rpc('match_lesson_memories', {
      query_embedding: queryEmbedding,
      match_user_id: learnerId,
      match_count: 5,
    });
    if (error) throw error;
    return (data ?? []).map((row: { summary_text: string }) => row.summary_text);
  } catch {
    // Embedding model not ready yet / RPC unavailable — fall back rather than
    // open with no memory at all.
    const { data } = await supabase
      .from('lesson_memory_vectors')
      .select('summary_text')
      .eq('user_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(5);
    return (data ?? []).map((row) => row.summary_text);
  }
}
