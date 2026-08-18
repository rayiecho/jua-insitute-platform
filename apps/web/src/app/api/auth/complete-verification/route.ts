import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionAndVerify } from '@/lib/auth/provision';

// Called by AuthHashHandler right after it establishes the session from the
// magic-link hash (setSession) — this is the one place that actually marks
// the learner verified and (if they were mid-enrollment) creates their
// enrollment. See lib/auth/provision.ts for why this can't happen at
// application time.
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { redirectTo, error } = await provisionAndVerify(admin, user);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ redirectTo });
}
