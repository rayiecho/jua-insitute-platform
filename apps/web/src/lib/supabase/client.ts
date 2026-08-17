'use client';

import { createBrowserClient } from '@supabase/ssr';

// For Client Components — the real auth session (email OTP sign-in,
// sign-out) lives here, not in localStorage like the old learner.ts stand-in.
export function createBrowserSupabaseClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
