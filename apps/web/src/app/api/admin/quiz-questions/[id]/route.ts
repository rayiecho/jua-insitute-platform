import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// No access control yet — same posture as the rest of /admin (see
// apps/web/src/app/admin/layout.tsx). Add real admin-role gating before
// this is reachable by anyone other than the person who knows the URL.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
