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

// Mounted globally (root layout) because the magic-link/Google redirect can
// land on ANY page — Supabase always truncates our requested redirect path
// down to the bare origin, so this can't assume it's running on a dedicated
// callback route.
//
// The session tokens arrive as a URL FRAGMENT (#access_token=...), not a
// ?code= query param — this project's Supabase auth uses the implicit flow.
//
// This can't rely on @supabase/ssr's built-in detectSessionInUrl: its
// createBrowserClient hardcodes flowType: "pkce" (confirmed by reading
// node_modules/@supabase/ssr — it's set *after* the options spread, so it
// cannot be overridden). Internally, GoTrueClient._getSessionFromURL()
// compares the URL's actual shape against `this.flowType`, and since our
// hash is an implicit-grant URL while the client is forced into "pkce", it
// throws AuthPKCEGrantCodeExchangeError('Not a valid PKCE flow url.') and
// silently gives up — no session is ever created, so SIGNED_IN never fires.
// This is why the previous version of this component (which just
// instantiated the client and waited on onAuthStateChange) never worked.
//
// The real fix: parse the hash ourselves and hand the tokens to
// setSession() directly, skipping the SDK's broken auto-detection.
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!window.location.hash.includes('access_token')) return;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return;

    const supabase = createBrowserSupabaseClient();

    supabase.auth.setSession({ access_token, refresh_token }).then(async ({ error }) => {
      // Strip the token fragment either way so it doesn't linger in the
      // address bar or get shared/bookmarked.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      if (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to establish session from magic link:', error);
        return;
      }

      // Marks the learner verified and, if they were mid-enrollment, creates
      // the real enrollment row — see /api/auth/complete-verification.
      // Its redirectTo (first lesson, or dashboard) wins over the plain
      // `next` cookie when both are present, since it reflects what actually
      // just happened server-side.
      let redirectTo: string | null = null;
      try {
        const res = await fetch('/api/auth/complete-verification', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          redirectTo = data.redirectTo ?? null;
        }
      } catch {
        // Network hiccup — fall through to the cookie-based next below
        // rather than stranding the learner on a blank page.
      }

      const next = redirectTo || readCookie(NEXT_COOKIE) || '/';
      deleteCookie(NEXT_COOKIE);
      router.replace(next);
    });
  }, [router]);

  return null;
}
