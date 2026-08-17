import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Reads/writes student_assignments_progress.current_code_state — the Shared
// Focus data the agent's state-injection subscribes to (Section 4.1). Goes
// through the admin client rather than letting the browser talk to Supabase
// directly, since RLS is on with no policies yet (see /learn/[slug]/page.tsx).

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const learnerId = searchParams.get('learnerId');
  const assignmentId = searchParams.get('assignmentId');
  if (!learnerId || !assignmentId) {
    return NextResponse.json({ error: 'learnerId and assignmentId query params are required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('student_assignments_progress')
    .select('current_code_state')
    .eq('user_id', learnerId)
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  return NextResponse.json({ currentCodeState: data?.current_code_state ?? null });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { learnerId, assignmentId, code } = body ?? {};
  if (!learnerId || !assignmentId || typeof code !== 'string') {
    return NextResponse.json({ error: 'learnerId, assignmentId, and code are required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('student_assignments_progress').upsert(
    {
      user_id: learnerId,
      assignment_id: assignmentId,
      current_code_state: code,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,assignment_id' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
