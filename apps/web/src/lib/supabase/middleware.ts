import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const NEXT_COOKIE = 'auth_next';

// Keeps the auth session cookie refreshed on every request — Server
// Components can't write cookies themselves (Next.js restriction), so
// without this, sessions would silently expire instead of auto-refreshing.
//
// ALSO handles the magic-link/OAuth code exchange here rather than only in
// /auth/callback. Confirmed live (2026-08-18): even with Site URL and a
// correctly wildcarded Redirect URL configured in Supabase, the actual
// email link that gets sent truncates whatever path/query we request down
// to the bare origin — so `?code=...` can land on any page, not reliably
// on /auth/callback, and any `next` destination we tried to pass via the
// URL was silently dropped by Supabase before it ever reached us. Handling
// "there's a code in the URL" in middleware means it gets exchanged no
// matter where it lands, and `next` survives because it's stashed in a
// cookie (set by EmailAuthForm before redirecting to Supabase) instead of
// relying on Supabase to round-trip a query param it doesn't preserve.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    const next = request.cookies.get(NEXT_COOKIE)?.value || '/';

    const redirectUrl = new URL(error ? '/' : next, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Carry over the session cookies exchangeCodeForSession just wrote via
    // setAll (onto `response`) — a fresh redirect response starts with none.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    redirectResponse.cookies.delete(NEXT_COOKIE);
    return redirectResponse;
  }

  // Must call getUser() (not just getSession()) — this is what actually
  // triggers the refresh and re-validates the token against Supabase.
  await supabase.auth.getUser();

  return response;
}
