import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// "Cannot have a live class if not enrolled in a program" — derives the
// learner from the real session, not a client-supplied id, so this can't be
// spoofed by passing someone else's learnerId.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ enrolled: false });
  }

  const admin = createAdminClient();
  const { data } = await admin.from('enrollments').select('id').eq('user_id', user.id).limit(1);

  return NextResponse.json({ enrolled: (data ?? []).length > 0 });
}
