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
// land on ANY page — confirmed live (2026-08-18) that Supabase always
// truncates our requested redirect path down to the bare origin, so this
// can't assume it's running on a dedicated callback route.
//
// The session tokens arrive as a URL FRAGMENT (#access_token=...), not a
// ?code= query param — this project's Supabase auth uses the implicit
// flow, not PKCE. Fragments are never sent to the server (browsers strip
// them before the HTTP request even goes out), so middleware genuinely
// cannot see this — it has to be handled client-side. Just instantiating
// the Supabase browser client is enough to trigger @supabase/ssr's
// built-in hash detection, which both establishes the session and syncs it
// into cookies for the server to see on the next request. This component's
// only real job is: once that's happened, clean the fragment out of the
// URL and send the user wherever `next` (stashed in a cookie by
// EmailAuthForm before redirecting to Supabase) says they were headed.
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!window.location.hash.includes('access_token')) return;

    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN') return;
      subscription.unsubscribe();
      const next = readCookie(NEXT_COOKIE) || '/';
      deleteCookie(NEXT_COOKIE);
      router.replace(next);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
