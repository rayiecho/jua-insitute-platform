'use client';

import { usePathname } from 'next/navigation';
import { type Learner, useLearnerSession } from '@/lib/learner';
import { EmailAuthForm } from '@/components/auth/EmailAuthForm';

export function LearnerGate({ children }: { children: (learner: Learner) => React.ReactNode }) {
  const { learner, loading } = useLearnerSession();
  const pathname = usePathname();

  if (loading) return null;

  if (!learner) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Who&apos;s learning?</h1>
        <p className="text-sm text-ink/60">
          Verify your email so your tutor remembers you between sessions.
        </p>
        <EmailAuthForm mode="enroll" next={pathname} />
      </main>
    );
  }

  return <>{children(learner)}</>;
}
