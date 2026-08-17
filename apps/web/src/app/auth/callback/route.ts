import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Where the magic link sent by supabase.auth.signInWithOtp() lands. Exchanges
// the code for a real session, then provisions the matching platform_users
// row on first sign-in — platform_users.id is deliberately the SAME uuid as
// the auth.users id, so every existing table keyed on learner.id (enrollments,
// session_curriculum_context, etc.) needed zero changes for this migration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/?authError=missing_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?authError=verification_failed`);
  }

  const user = data.user;
  const admin = createAdminClient();
  const { data: existing } = await admin.from('platform_users').select('id').eq('id', user.id).maybeSingle();

  if (!existing) {
    const meta = user.user_metadata as { first_name?: string; last_name?: string };
    await admin.from('platform_users').insert({
      id: user.id,
      email: user.email,
      first_name: meta.first_name?.trim() || 'there',
      last_name: meta.last_name?.trim() || '',
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
