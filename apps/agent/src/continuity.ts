import { supabase } from './supabase.js';

export interface OpeningContext {
  systemPrompt: string;
  openingLine: string;
}

// Section 4.4 — "Pick up where we left off". Runs once at session start, before
// the tutor speaks. All three queries are independent so they run in parallel;
// each is allowed to come back empty (first-ever session for this learner).
export async function buildOpeningContext(learnerId: string): Promise<OpeningContext> {
  const [progress, lastSession, memories] = await Promise.all([
    fetchInProgressAssignment(learnerId),
    fetchLastSessionSummary(learnerId),
    fetchRelevantMemories(learnerId),
  ]);

  const parts: string[] = [
    'You are a 1-on-1 AI tutor picking up an ongoing relationship with this learner.',
  ];
  if (lastSession) parts.push(`Last session summary: ${lastSession}`);
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
    openingLine: lastSession
      ? 'Welcome the learner back and reference what they were working on last time.'
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

async function fetchLastSessionSummary(learnerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('session_curriculum_context')
    .select('session_summary')
    .eq('user_id', learnerId)
    .not('session_summary', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.session_summary ?? null;
}

async function fetchRelevantMemories(learnerId: string): Promise<string[]> {
  // TODO(Phase 4): replace with an embedding similarity search
  // (match against the current curriculum node's embedding via pgvector <->)
  // once the embedding pipeline exists. For now, most-recent-N as a placeholder.
  const { data } = await supabase
    .from('lesson_memory_vectors')
    .select('summary_text')
    .eq('user_id', learnerId)
    .order('created_at', { ascending: false })
    .limit(5);

  return (data ?? []).map((row) => row.summary_text);
}
