import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const userId = formData.get('userId')?.toString();

  if (userId) {
    const admin = createAdminClient();
    await admin.from('class_session_enrollments').delete().eq('class_session_id', id).eq('user_id', userId);
  }

  return NextResponse.redirect(new URL(`/admin/classes/${id}`, request.url), { status: 303 });
}
