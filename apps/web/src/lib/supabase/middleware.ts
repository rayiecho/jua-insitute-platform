import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const NEXT_COOKIE = 'auth_next';

// Keeps the auth session cookie refreshed on every request — Server
// Components can't write cookies themselves (Next.js restriction), so
// without this, sessions would silently expire instead of auto-refreshing.
//
// Also handles a PKCE-style `?code=` redirect, if one ever shows up — kept
// as a defensive fallback even though a live test (2026-08-18) showed this
// project's Supabase auth actually uses the *implicit* flow (session
// tokens arrive as a URL fragment, #access_token=..., which servers can
// never see — browsers strip fragments before the HTTP request goes out).
// That real case is handled client-side instead, in
// components/auth/AuthHashHandler.tsx (mounted globally in the root
// layout), which is the only place capable of reading window.location.hash.
// Both paths read/clear the same `auth_next` cookie so `next` survives
// regardless of which flow actually fires.
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
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
    for (const setCookieValue of response.headers.getSetCookie()) {
      redirectResponse.headers.append('Set-Cookie', setCookieValue);
    }
    redirectResponse.cookies.delete(NEXT_COOKIE);
    return redirectResponse;
  }

  // Must call getUser() (not just getSession()) — this is what actually
  // triggers the refresh and re-validates the token against Supabase.
  await supabase.auth.getUser();

  return response;
}
