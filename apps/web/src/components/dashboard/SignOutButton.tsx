'use client';

import { useRouter } from 'next/navigation';
import { useLearnerSession } from '@/lib/learner';

export function SignOutButton() {
  const { signOut } = useLearnerSession();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push('/');
      }}
      className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-left text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
    >
      Sign out
    </button>
  );
}
