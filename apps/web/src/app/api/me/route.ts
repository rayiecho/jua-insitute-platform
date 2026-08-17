import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// The real-auth replacement for the old localStorage-based learner lookup.
// Reads the authenticated user from the session cookie, then uses the admin
// client to fetch their platform_users row — same RLS-bypass pattern every
// other route already uses, rather than opening up new RLS policies just
// for this one read.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ learner: null });
  }

  const admin = createAdminClient();
  const { data: learner } = await admin
    .from('platform_users')
    .select('id, first_name, last_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (!learner) {
    return NextResponse.json({ learner: null });
  }

  return NextResponse.json({
    learner: { id: learner.id, firstName: learner.first_name, lastName: learner.last_name, email: learner.email },
  });
}
