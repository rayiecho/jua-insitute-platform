'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

// Real email verification via Supabase Auth magic links — no new vendor
// needed, Supabase sends the email itself. 'enroll' mode collects a name
// (first-time registration, e.g. from EnrollAndStartButton); 'signin' mode
// is email-only for returning learners joining a live class, matching "they
// just type their email address, not all names."
export function EmailAuthForm({
  mode,
  next,
  onSent,
}: {
  mode: 'enroll' | 'signin';
  next: string;
  onSent?: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: mode === 'enroll' ? { first_name: firstName, last_name: lastName } : undefined,
        },
      });
      if (sendError) throw sendError;
      setSent(true);
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification email');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-gold bg-gold/10 px-4 py-3">
        <p className="text-sm font-medium text-ink">Check your email</p>
        <p className="mt-1 text-sm text-ink/60">
          We sent a verification link to <span className="font-medium">{email}</span>. Click it to continue.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {mode === 'enroll' && (
        <>
          <input
            className="rounded border border-border bg-card px-3 py-2 text-ink"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            className="rounded border border-border bg-card px-3 py-2 text-ink"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </>
      )}
      <input
        className="rounded border border-border bg-card px-3 py-2 text-ink"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus={mode === 'signin'}
      />
      <button
        type="submit"
        disabled={submitting || !email.trim() || (mode === 'enroll' && (!firstName.trim() || !lastName.trim()))}
        className="rounded bg-gold px-3 py-2 font-semibold text-ink disabled:opacity-50"
      >
        {submitting ? 'Sending…' : mode === 'enroll' ? 'Verify email & continue' : 'Send sign-in link'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
