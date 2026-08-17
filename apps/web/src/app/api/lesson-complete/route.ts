import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Marks a lesson complete for the signed-in learner — the "Mark as
// complete" button for reading/video/case_study/puzzle lessons, and the
// auto-fire on finishing a quiz (QuizLesson). Assignment-backed lessons
// complete via /api/grade instead (grading IS the completion signal there).
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { nodeId } = await request.json().catch(() => ({}));
  if (!nodeId) return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('lesson_completions')
    .upsert({ user_id: user.id, node_id: nodeId }, { onConflict: 'user_id,node_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
