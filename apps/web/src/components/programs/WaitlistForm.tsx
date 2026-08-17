'use client';

import { useState } from 'react';

export function WaitlistForm({ courseId }: { courseId: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, courseId }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return <p className="text-sm font-medium text-gold-dark">You&apos;re on the list — we&apos;ll email you at launch.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-w-0 flex-1 rounded border border-border bg-card px-3 py-2 text-sm text-ink"
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="shrink-0 rounded bg-ink px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {status === 'submitting' ? 'Joining…' : 'Join waitlist'}
      </button>
      {status === 'error' && <p className="text-xs text-red-600">Something went wrong — try again.</p>}
    </form>
  );
}
