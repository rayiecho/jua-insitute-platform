'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

const NEXT_COOKIE = 'auth_next';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function withAuthError(path: string, message: string): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('authError', encodeURIComponent(message));
  return url.pathname + url.search;
}

// Mounted globally (root layout) because the magic-link/Google redirect can
// land on ANY page — Supabase always truncates our requested redirect path
// down to the bare origin, so this can't assume it's running on a dedicated
// callback route.
//
// The session tokens arrive as a URL FRAGMENT (#access_token=...), not a
// ?code= query param — this project's Supabase auth uses the implicit flow.
// This can't rely on @supabase/ssr's built-in detectSessionInUrl: its
// createBrowserClient hardcodes flowType: "pkce", so it rejects our hash and
// silently gives up — this parses the hash itself and calls setSession()
// directly.
//
// Every failure path below reports through AuthErrorBanner (via an
// `authError` query param) instead of only logging to the console — a link
// that fails partway through used to just leave the learner back at "not
// verified" with zero visibility into why.
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('access_token') && !hash.includes('error')) return;

    const params = new URLSearchParams(hash.slice(1));

    if (params.get('error')) {
      const description = params.get('error_description') || 'The verification link failed or already expired.';
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      router.replace(withAuthError(window.location.pathname, description.replace(/\+/g, ' ')));
      return;
    }

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return;

    const supabase = createBrowserSupabaseClient();

    supabase.auth.setSession({ access_token, refresh_token }).then(async ({ error }) => {
      // Strip the token fragment either way so it doesn't linger in the
      // address bar or get shared/bookmarked.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      if (error) {
        router.replace(withAuthError(window.location.pathname, `Sign-in failed: ${error.message}`));
        return;
      }

      // Marks the learner verified and, if they were mid-enrollment, creates
      // the real enrollment row — see /api/auth/complete-verification.
      // Its redirectTo (first lesson, or dashboard) wins over the plain
      // `next` cookie when both are present, since it reflects what actually
      // just happened server-side.
      try {
        const res = await fetch('/api/auth/complete-verification', { method: 'POST' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          router.replace(
            withAuthError(window.location.pathname, `Verification didn't complete: ${body.error ?? res.status}`),
          );
          return;
        }
        const data = await res.json();
        const next = data.redirectTo || readCookie(NEXT_COOKIE) || '/';
        deleteCookie(NEXT_COOKIE);
        router.replace(next);
      } catch {
        router.replace(withAuthError(window.location.pathname, 'Verification didn\'t complete — a network error occurred.'));
      }
    });
  }, [router]);

  return null;
}
