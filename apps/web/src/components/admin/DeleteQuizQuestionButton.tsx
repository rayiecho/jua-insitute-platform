'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteQuizQuestionButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Delete this question?')) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/quiz-questions/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
