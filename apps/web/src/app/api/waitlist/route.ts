import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email?.trim().toLowerCase();
  const courseId: string | undefined = body?.courseId;

  if (!email || !courseId) {
    return NextResponse.json({ error: 'email and courseId are required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('waitlist_signups')
    .upsert({ email, course_id: courseId }, { onConflict: 'email,course_id', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
