'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  type Learner,
  getLearnerServerSnapshot,
  getLearnerSnapshot,
  registerLearner,
  subscribeLearner,
} from '@/lib/learner';

export function LearnerGate({ children }: { children: (learner: Learner) => React.ReactNode }) {
  const learner = useSyncExternalStore(subscribeLearner, getLearnerSnapshot, getLearnerServerSnapshot);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerLearner({ firstName, lastName, email });
      // registerLearner writes to localStorage; this state update is what
      // triggers the re-render that picks up the new snapshot.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue');
    } finally {
      setSubmitting(false);
    }
  }

  if (!learner) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Who&apos;s learning?</h1>
        <p className="text-sm text-ink/60">
          Tell us who you are so your tutor remembers you between sessions.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            className="rounded bg-gold px-3 py-2 font-semibold text-ink disabled:opacity-50"
          >
            {submitting ? 'Continuing…' : 'Continue'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </main>
    );
  }

  return <>{children(learner)}</>;
}
