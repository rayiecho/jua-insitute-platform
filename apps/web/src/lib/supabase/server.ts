import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// For Server Components / Route Handlers — reads/writes the real auth
// session via cookies. Server Components can't set cookies (Next.js
// restriction), so the try/catch below is expected there; middleware.ts is
// what actually keeps the session refreshed in that case.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — middleware.ts handles refresh instead.
        }
      },
    },
  });
}
