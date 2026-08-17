import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildGradingScript, runPython } from '@/lib/sandbox';

// Section 4.6 — Cost-Gated Grading. This is the margin protector: the LLM is
// only ever called after the sandbox has already run the code, and never at
// all if the failure is a syntax/exec-time error the sandbox already explains
// perfectly well on its own. learnerId comes from the real session, not the
// request body — a client-supplied id would let anyone submit and burn LLM
// grading calls against another learner's assignment record.
export async function POST(request: Request) {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  const learnerId = user.id;

  const body = await request.json().catch(() => null);
  const assignmentId: string | undefined = body?.assignmentId;
  const code: string | undefined = body?.code;

  if (!assignmentId || typeof code !== 'string') {
    return NextResponse.json({ error: 'assignmentId and code are required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: assignment, error: assignmentError } = await supabase
    .from('course_assignments')
    .select('title, instructions_markdown, unit_test_suite_code, max_score, node_id')
    .eq('id', assignmentId)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return NextResponse.json({ error: 'assignment not found' }, { status: 404 });
  }
  if (!assignment.unit_test_suite_code) {
    return NextResponse.json({ error: 'assignment has no test suite configured' }, { status: 400 });
  }

  // Step 1 — always run in the sandbox first (Section 4.6.1).
  const script = buildGradingScript(code, assignment.unit_test_suite_code);
  const result = await runPython(script);

  // Step 2 — syntax/exec-time failure: return the raw error instantly, never
  // call the LLM for this (Section 4.6.2).
  if (result.isSyntaxError) {
    await saveGrade(supabase, learnerId, assignmentId, {
      grading_status: 'needs_revision',
      score_achieved: 0,
      ai_feedback_report: null,
    });
    return NextResponse.json({
      gradingStatus: 'needs_revision',
      score: 0,
      rawError: result.output,
      feedback: null,
    });
  }

  // Step 3 — compiled/ran (whether tests passed or failed): bundle for an LLM
  // audit. This is the only path that costs real AI tokens (Section 4.6.4).
  const testsPassed = result.exitedCleanly && result.output.includes('ALL_TESTS_PASSED');
  const review = await requestLLMReview({
    instructions: assignment.instructions_markdown,
    studentCode: code,
    testsPassed,
    sandboxOutput: result.output,
    maxScore: assignment.max_score,
  });

  await saveGrade(supabase, learnerId, assignmentId, {
    grading_status: 'graded',
    score_achieved: review.score,
    ai_feedback_report: review.feedback,
  });

  // A graded submission (any score — re-attempting for a better one is
  // optional) is enough to unlock the next lesson. "graded" here means "got
  // real feedback," not "passed," matching how the rest of the platform
  // already treats this status.
  if (assignment.node_id) {
    await supabase
      .from('lesson_completions')
      .upsert({ user_id: learnerId, node_id: assignment.node_id }, { onConflict: 'user_id,node_id' });
  }

  return NextResponse.json({
    gradingStatus: 'graded',
    score: review.score,
    rawError: testsPassed ? null : result.output,
    feedback: review.feedback,
  });
}

async function saveGrade(
  supabase: ReturnType<typeof createAdminClient>,
  learnerId: string,
  assignmentId: string,
  fields: { grading_status: string; score_achieved: number; ai_feedback_report: string | null },
) {
  await supabase.from('student_assignments_progress').upsert(
    { user_id: learnerId, assignment_id: assignmentId, updated_at: new Date().toISOString(), ...fields },
    { onConflict: 'user_id,assignment_id' },
  );
}

interface LLMReview {
  score: number;
  feedback: string;
}

// TEMPORARY: spec Section 2 calls for Claude here ("grading & deep feedback").
// No ANTHROPIC_API_KEY configured yet, so this runs on Groq as a stand-in —
// same substitution already made for the live-tutoring LLM in apps/agent.
// Swap the model/endpoint here once Anthropic access exists.
async function requestLLMReview(input: {
  instructions: string;
  studentCode: string;
  testsPassed: boolean;
  sandboxOutput: string;
  maxScore: number;
}): Promise<LLMReview> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // No LLM available — fall back to a sandbox-only verdict rather than fail closed.
    return {
      score: input.testsPassed ? input.maxScore : 0,
      feedback: input.testsPassed
        ? 'All automated tests passed. (No LLM configured for deeper review.)'
        : `Automated tests failed:\n\n${input.sandboxOutput}`,
    };
  }

  const prompt = `You are grading a learner's Python assignment.

Assignment instructions:
${input.instructions}

Learner's code:
\`\`\`python
${input.studentCode}
\`\`\`

Automated test result: ${input.testsPassed ? 'PASSED' : 'FAILED'}
Sandbox output:
${input.sandboxOutput || '(clean run, no output captured)'}

Score out of ${input.maxScore} and give brief, specific, encouraging feedback (2-4 sentences) a tutor could say
out loud. Respond with ONLY a JSON object: {"score": <integer 0-${input.maxScore}>, "feedback": "<string>"}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    return {
      score: input.testsPassed ? input.maxScore : 0,
      feedback: input.testsPassed
        ? 'All automated tests passed. (LLM review unavailable.)'
        : `Automated tests failed:\n\n${input.sandboxOutput}`,
    };
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '{}';
  try {
    const parsed = JSON.parse(content);
    const score = Math.max(0, Math.min(input.maxScore, Number(parsed.score) || 0));
    return { score, feedback: String(parsed.feedback ?? '') };
  } catch {
    return {
      score: input.testsPassed ? input.maxScore : 0,
      feedback: content || 'Could not parse review response.',
    };
  }
}
