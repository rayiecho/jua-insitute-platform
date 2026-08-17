'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLearnerSession } from '@/lib/learner';
import { EmailAuthForm } from '@/components/auth/EmailAuthForm';

// The explicit "I'm enrolling in this program" moment (Section 4.4) — this is
// what makes the tutor coach on THIS course rather than guessing. First-time
// visitors verify their email (real Supabase Auth magic link) before
// enrollment completes — see /enroll/complete, where the flow picks back up
// once they click the link.
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
  const [showIdentify, setShowIdentify] = useState(false);
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

  if (showIdentify) {
    const next = `/enroll/complete?courseId=${encodeURIComponent(courseId)}&lessonHref=${encodeURIComponent(firstLessonHref)}`;
    return (
      <div className="mt-8 max-w-sm">
        <p className="mb-2 text-sm text-ink/60">Verify your email so your tutor remembers you between sessions.</p>
        <EmailAuthForm mode="enroll" next={next} />
      </div>
    );
  }

  return (
    <button onClick={() => (learner ? enrollAndGo() : setShowIdentify(true))} disabled={busy} className={className}>
      {busy ? 'Enrolling…' : 'Start the program'}
    </button>
  );
}
