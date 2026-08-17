'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

// Real email verification via Supabase Auth — magic links (no new vendor
// needed, Supabase/AWS SES sends the email) or Google Sign-In, both go
// through the same /auth/callback and both count as "verified" the same
// way. Verification happens once, at first sign-in — after that, the
// session cookie persists (see middleware.ts), so returning learners just
// land on whatever page they visit already signed in, no repeat
// verification. 'enroll' mode collects a name (first-time registration,
// e.g. from EnrollAndStartButton) for the email path — Google supplies a
// name automatically. 'signin' mode is email-only for returning learners
// joining a live class, matching "they just type their email address."
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
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setGoogleSubmitting(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (oauthError) throw oauthError;
      // On success the SDK redirects the browser itself — nothing else to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google sign-in');
      setGoogleSubmitting(false);
    }
  }

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
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleSubmitting}
        className="flex items-center justify-center gap-2 rounded border border-border bg-card px-3 py-2 font-medium text-ink hover:bg-background disabled:opacity-50"
      >
        <GoogleIcon />
        {googleSubmitting ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="flex items-center gap-3 text-xs text-ink/40">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

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
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11C3.24 21.3 7.28 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.26A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.26 5.39l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}
