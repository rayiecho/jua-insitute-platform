'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLearnerSession } from '@/lib/learner';
import { EnrollmentForm } from '@/components/programs/EnrollmentForm';

// The explicit "I'm enrolling in this program" moment (Section 4.4). First-
// time applicants fill in the full application (see EnrollmentForm) and
// verify their email once — the enrollment row itself is created
// server-side when they click that link (lib/auth/provision.ts), which then
// lands them straight on the first lesson. Someone who's already verified
// and signed in (e.g. enrolling in a second program from the same browser)
// skips straight to enrolling via the existing session.
export function EnrollAndStartButton({
  courseId,
  firstLessonHref,
  className,
}: {
  courseId: string;
  firstLessonHref: string;
  className?: string;
}) {
  const { learner } = useLearnerSession();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function enrollAndGo() {
    setBusy(true);
    try {
      await fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
    } finally {
      router.push(firstLessonHref);
    }
  }

  if (showForm) {
    return <EnrollmentForm courseId={courseId} className="mt-8 max-w-sm" />;
  }

  return (
    <button onClick={() => (learner ? enrollAndGo() : setShowForm(true))} disabled={busy} className={className}>
      {busy ? 'Enrolling…' : 'Start the program'}
    </button>
  );
}
