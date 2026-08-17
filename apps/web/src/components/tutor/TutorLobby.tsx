'use client';

import { useState } from 'react';
import { registerLearner, type Learner } from '@/lib/learner';
import { LogoMark } from '@/components/brand/Logo';
import { ClassroomShell } from './ClassroomShell';
import { TutorSessionRoom } from './TutorSessionRoom';

type Step = 'identify' | 'ready' | 'in-session';

// The live-class entry ritual — deliberately NOT auto-join, and deliberately
// asks who you are every time rather than silently trusting a cached
// localStorage identity. Two reasons: (1) it's how joining a real class
// feels — you show up and say who you are; (2) this machine has been used
// to test multiple learner accounts in the same browser, and a stale cached
// identity has already caused one real confusion (the tutor referencing the
// wrong lesson). /api/learner finds-or-creates by email, so returning
// learners land on their real existing record either way.
export function TutorLobby() {
  const [step, setStep] = useState<Step>('identify');
  const [learner, setLearner] = useState<Learner | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const identified = await registerLearner({ firstName, lastName, email });
      setLearner(identified);
      setStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'in-session' && learner) {
    return (
      <TutorSessionRoom
        room={`learner-${learner.id}`}
        learner={learner}
        onLeave={() => {
          setStep('ready');
        }}
      />
    );
  }

  return (
    <ClassroomShell>
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 py-16">
        <LogoMark className="h-12 w-12" />

        {step === 'identify' && (
          <form onSubmit={handleIdentify} className="mt-8 flex w-full flex-col gap-3">
            <h1 className="text-center font-serif text-2xl font-semibold text-ink">Join the live class</h1>
            <p className="mb-2 text-center text-sm text-ink/60">Tell us who you are so your tutor picks up where you left off.</p>
            <input
              className="rounded border border-border bg-card px-3 py-2 text-ink"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
            />
            <input
              className="rounded border border-border bg-card px-3 py-2 text-ink"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              className="rounded border border-border bg-card px-3 py-2 text-ink"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={submitting || !firstName.trim() || !lastName.trim() || !email.trim()}
              className="mt-2 rounded bg-gold px-3 py-2 font-semibold text-ink disabled:opacity-50"
            >
              {submitting ? 'Checking…' : 'Continue'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        {step === 'ready' && learner && (
          <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
            <p className="font-serif text-xl font-semibold text-ink">Ready, {learner.firstName}?</p>
            <p className="text-sm text-ink/60">Your tutor will be with you as soon as you join.</p>
            <div className="mt-2 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => setStep('in-session')}
                className="rounded bg-gold px-4 py-3 font-semibold text-ink"
              >
                Join class
              </button>
              <button
                type="button"
                onClick={() => {
                  setLearner(null);
                  setStep('identify');
                }}
                className="text-sm text-ink/50 hover:text-ink"
              >
                Not {learner.firstName}?
              </button>
            </div>
          </div>
        )}
      </main>
    </ClassroomShell>
  );
}
