'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLearnerSession } from '@/lib/learner';

// Where the magic-link callback lands after a first-time "Start the program"
// click (see EnrollAndStartButton) — the enrollment itself couldn't happen
// synchronously with the click because email verification is out-of-band
// (open the email, click the link). By the time this page mounts, the
// session cookie is already set, so this just finishes the one API call and
// forwards to the first lesson.
export default function EnrollCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-ink/60">Finishing enrollment…</p>
        </main>
      }
    >
      <EnrollCompleteInner />
    </Suspense>
  );
}

function EnrollCompleteInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { learner, loading } = useLearnerSession();
  const [error, setError] = useState<string | null>(null);

  const courseId = searchParams.get('courseId');
  const lessonHref = searchParams.get('lessonHref');

  useEffect(() => {
    if (loading || !learner || !courseId || !lessonHref) return;
    fetch('/api/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    })
      .then(() => router.replace(lessonHref))
      .catch(() => setError('Something went wrong finishing enrollment — try starting the program again.'));
  }, [loading, learner, courseId, lessonHref, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      {error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-ink/60">Finishing enrollment…</p>}
    </main>
  );
}
