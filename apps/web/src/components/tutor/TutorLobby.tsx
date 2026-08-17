'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLearnerSession } from '@/lib/learner';
import { EmailAuthForm } from '@/components/auth/EmailAuthForm';
import { LogoMark } from '@/components/brand/Logo';
import { ClassroomShell } from './ClassroomShell';
import { TutorSessionRoom } from './TutorSessionRoom';

type Step = 'ready' | 'in-session';

// The live-class entry ritual. Real auth now (Supabase magic link) instead
// of a name/email form — returning learners "just type their email
// address," per the actual requirement, since verification already proved
// who they are; new learners only hit this if they somehow reach /tutor
// without ever enrolling, in which case they're sent to enroll first rather
// than being let into a class for a program they haven't started.
export function TutorLobby() {
  const { learner, loading } = useLearnerSession();
  const [step, setStep] = useState<Step>('ready');
  const [enrolled, setEnrolled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!learner) {
      setEnrolled(null);
      return;
    }
    fetch('/api/my-enrollments')
      .then((r) => r.json())
      .then((data) => setEnrolled(Boolean(data.enrolled)))
      .catch(() => setEnrolled(false));
  }, [learner]);

  if (step === 'in-session' && learner) {
    return (
      <TutorSessionRoom
        room={`learner-${learner.id}`}
        learner={learner}
        onLeave={() => setStep('ready')}
      />
    );
  }

  return (
    <ClassroomShell>
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 py-16">
        <LogoMark className="h-12 w-12" />

        {loading && <p className="mt-8 text-sm text-ink/50">Checking your session…</p>}

        {!loading && !learner && (
          <div className="mt-8 w-full">
            <h1 className="text-center font-serif text-2xl font-semibold text-ink">Join the live class</h1>
            <p className="mb-4 mt-2 text-center text-sm text-ink/60">
              Enter your email — we&apos;ll send a link to verify it&apos;s you.
            </p>
            <EmailAuthForm mode="signin" next="/tutor" />
          </div>
        )}

        {!loading && learner && enrolled === false && (
          <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
            <p className="font-serif text-xl font-semibold text-ink">Not enrolled yet</p>
            <p className="text-sm text-ink/60">
              You need to enroll in a program before joining a live class — your tutor teaches from your actual
              curriculum, so there's nothing to coach on until you've started one.
            </p>
            <Link href="/programs" className="mt-2 rounded bg-gold px-6 py-3 font-semibold text-ink">
              Browse programs
            </Link>
          </div>
        )}

        {!loading && learner && enrolled === true && (
          <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
            <p className="font-serif text-xl font-semibold text-ink">Ready, {learner.firstName}?</p>
            <p className="text-sm text-ink/60">Your tutor will be with you as soon as you join.</p>
            <button
              type="button"
              onClick={() => setStep('in-session')}
              className="mt-2 w-full rounded bg-gold px-4 py-3 font-semibold text-ink"
            >
              Join class
            </button>
          </div>
        )}
      </main>
    </ClassroomShell>
  );
}
