'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function MarkCompleteButton({ nodeId, alreadyDone }: { nodeId: string; alreadyDone: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  if (alreadyDone) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm font-medium text-ink">
        <span aria-hidden>✓</span> Completed
      </div>
    );
  }

  async function handleClick() {
    setSubmitting(true);
    try {
      await fetch('/api/lesson-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={submitting}
      className="mt-6 rounded bg-gold px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
    >
      {submitting ? 'Marking…' : 'Mark as complete'}
    </button>
  );
}
