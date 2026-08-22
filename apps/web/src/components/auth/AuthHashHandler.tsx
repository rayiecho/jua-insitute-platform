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

// Mounted globally (root layout) because the Google OAuth redirect can land
// on ANY page — Supabase always truncates our requested redirect path down
// to the bare origin, so this can't assume it's running on a dedicated
// callback route (confirmed live 2026-08-18, see EmailAuthForm's stashNext
// comment) — that's also why apps/web/src/app/auth/callback/route.ts, a
// server route, never actually gets hit in practice.
//
// Two return shapes land here, both handled client-side rather than via
// @supabase/ssr's built-in detectSessionInUrl (its createBrowserClient
// hardcodes flowType: "pkce", which silently mishandles both of these):
//   1. A URL FRAGMENT (#access_token=...) — this project's email OTP/magic
//      links used to use this (implicit flow); handled by parsing the hash
//      and calling setSession() directly.
//   2. A ?code= query param — Google OAuth, initiated via signInWithOAuth()
//      on this same PKCE-flowType client, so the matching code_verifier is
//      already sitting in this browser's storage. exchangeCodeForSession()
//      client-side finds it and completes the exchange itself, rather than
//      relying on the server route Supabase never actually redirects to.
//
// Every failure path below reports through AuthErrorBanner (via an
// `authError` query param) instead of only logging to the console — a
// sign-in that fails partway through used to just leave the learner back at
// "not verified" with zero visibility into why.
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function completeSession() {
      // Strip the token fragment/code either way so it doesn't linger in the
      // address bar or get shared/bookmarked.
      window.history.replaceState(null, '', window.location.pathname);

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
    }

    const hash = window.location.hash;
    if (hash.includes('access_token') || hash.includes('error')) {
      const params = new URLSearchParams(hash.slice(1));

      if (params.get('error')) {
        const description = params.get('error_description') || 'Sign-in failed or the link already expired.';
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        router.replace(withAuthError(window.location.pathname, description.replace(/\+/g, ' ')));
        return;
      }

      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return;

      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          router.replace(withAuthError(window.location.pathname, `Sign-in failed: ${error.message}`));
          return;
        }
        void completeSession();
      });
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error_description');
    if (oauthError) {
      router.replace(withAuthError(window.location.pathname, oauthError.replace(/\+/g, ' ')));
      return;
    }
    if (!code) return;

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        router.replace(withAuthError(window.location.pathname, `Sign-in failed: ${error.message}`));
        return;
      }
      void completeSession();
    });
  }, [router]);

  return null;
}
