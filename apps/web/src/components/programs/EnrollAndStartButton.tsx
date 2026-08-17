'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import {
  getLearnerServerSnapshot,
  getLearnerSnapshot,
  registerLearner,
  subscribeLearner,
} from '@/lib/learner';

// The explicit "I'm enrolling in this program" moment (Section 4.4) — this is
// what makes the tutor coach on THIS course rather than guessing. If we don't
// know the learner yet, ask inline (same identity as the tutor gate) rather
// than bouncing them to an unrelated page mid-click.
export function EnrollAndStartButton({
  courseId,
  firstLessonHref,
  className,
}: {
  courseId: string;
  firstLessonHref: string;
  className?: string;
}) {
  const learner = useSyncExternalStore(subscribeLearner, getLearnerSnapshot, getLearnerServerSnapshot);
  const [showIdentify, setShowIdentify] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function enrollAndGo(userId: string) {
    setBusy(true);
    try {
      await fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId }),
      });
    } finally {
      router.push(firstLessonHref);
    }
  }

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const identified = await registerLearner({ firstName, lastName, email });
      await enrollAndGo(identified.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue');
      setBusy(false);
    }
  }

  if (showIdentify) {
    return (
      <form onSubmit={handleIdentify} className="mt-8 flex max-w-sm flex-col gap-3">
        <p className="text-sm text-ink/60">Tell us who you are so your tutor remembers you between sessions.</p>
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
          disabled={busy || !firstName.trim() || !lastName.trim() || !email.trim()}
          className="rounded bg-gold px-6 py-3 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {busy ? 'Enrolling…' : 'Enroll and start'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <button
      onClick={() => (learner ? enrollAndGo(learner.id) : setShowIdentify(true))}
      disabled={busy}
      className={className}
    >
      {busy ? 'Enrolling…' : 'Start the program'}
    </button>
  );
}
