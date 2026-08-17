import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Where both auth methods land after verifying — the magic link sent by
// supabase.auth.signInWithOtp() and the redirect back from Google via
// signInWithOAuth() both use this same PKCE code-exchange callback.
// Provisions the matching platform_users row on first sign-in only —
// platform_users.id is deliberately the SAME uuid as the auth.users id, so
// every existing table keyed on learner.id (enrollments,
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
    // Email sign-in supplies first_name/last_name explicitly (see
    // EmailAuthForm 'enroll' mode); Google supplies full_name/name instead —
    // split on the first space for a reasonable first/last.
    const meta = user.user_metadata as { first_name?: string; last_name?: string; full_name?: string; name?: string };
    let firstName = meta.first_name?.trim();
    let lastName = meta.last_name?.trim();
    if (!firstName) {
      const googleName = (meta.full_name ?? meta.name ?? '').trim();
      const [first, ...rest] = googleName.split(' ');
      firstName = first || 'there';
      lastName = rest.join(' ');
    }

    await admin.from('platform_users').insert({
      id: user.id,
      email: user.email,
      first_name: firstName || 'there',
      last_name: lastName ?? '',
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
