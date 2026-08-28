'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function AdminSignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.signOut();
        router.push('/');
      }}
      className="rounded border border-white/10 px-3 py-1.5 text-left text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
    >
      Sign out
    </button>
  );
}
