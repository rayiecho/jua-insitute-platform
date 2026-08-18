import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionAndVerify } from '@/lib/auth/provision';

// Defensive fallback for a PKCE-style `?code=` redirect, if one ever shows
// up (e.g. Google OAuth on a future Supabase config change) — the confirmed
// live case for this project is the implicit flow, handled client-side in
// components/auth/AuthHashHandler.tsx, which is what everything actually
// hits today.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/?authError=missing_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?authError=verification_failed`);
  }

  const admin = createAdminClient();
  const { redirectTo } = await provisionAndVerify(admin, data.user);

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
