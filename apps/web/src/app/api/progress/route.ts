import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Reads/writes student_assignments_progress.current_code_state — the Shared
// Focus data the agent's state-injection subscribes to (Section 4.1). Goes
// through the admin client rather than letting the browser talk to Supabase
// directly, since RLS is on with no policies yet (see /learn/[slug]/page.tsx).
// learnerId comes from the real session, not the request — a client-
// supplied id would let anyone read or overwrite another learner's in-
// progress code.

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get('assignmentId');
  if (!assignmentId) {
    return NextResponse.json({ error: 'assignmentId query param is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('student_assignments_progress')
    .select('current_code_state')
    .eq('user_id', user.id)
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  return NextResponse.json({ currentCodeState: data?.current_code_state ?? null });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { assignmentId, code } = body ?? {};
  if (!assignmentId || typeof code !== 'string') {
    return NextResponse.json({ error: 'assignmentId and code are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('student_assignments_progress').upsert(
    {
      user_id: user.id,
      assignment_id: assignmentId,
      current_code_state: code,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,assignment_id' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
