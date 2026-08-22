'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

// Replaces the magic-link click entirely for email verification. Typing a
// code in and submitting is a single request/response — verifyOtp() gets
// the session tokens directly in its API response and hands them to
// @supabase/ssr's storage adapter itself, the same way any other auth call
// does. There's no redirect, no URL fragment, and no dependency on
// detectSessionInUrl (which is what kept silently breaking — see
// AuthHashHandler's comments for the full history). This is the reliable
// path.
export function OtpVerifyForm({
  email,
  onVerified,
}: {
  email: string;
  // '' when the server has no specific destination in mind (not mid an
  // enrollment application) — callers decide their own fallback (e.g. a
  // `next` cookie, or '/dashboard') rather than this component picking one
  // that might override what the caller actually wants.
  onVerified: (redirectTo: string) => void;
}) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
      if (verifyError) throw verifyError;

      const res = await fetch('/api/auth/complete-verification', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Verification failed');

      onVerified(data.redirectTo ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is invalid or expired — try resending.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResendState('sending');
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({ email });
      if (otpError) throw otpError;
      setResendState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend the code');
      setResendState('idle');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-ink/60">
        Enter the verification code we sent to <span className="font-medium">{email}</span>.
      </p>
      <input
        className="rounded border border-border bg-card px-3 py-2 text-center text-lg tracking-[0.3em] text-ink"
        placeholder="Verification code"
        inputMode="numeric"
        // Supabase's OTP length is configurable per-project and this
        // project's is 8 digits, not the more common 6 — confirmed live
        // (2026-08-18) after a hardcoded maxLength={6} silently truncated a
        // real code and made a valid submission fail. No cap here; trust the
        // server to reject anything actually wrong.
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        required
        autoFocus
      />
      <button
        type="submit"
        disabled={submitting || code.length < 6}
        className="rounded bg-gold px-3 py-2 font-semibold text-ink disabled:opacity-50"
      >
        {submitting ? 'Verifying…' : 'Verify & continue'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={resend}
        disabled={resendState === 'sending'}
        className="text-xs font-medium text-tan hover:text-ink disabled:opacity-50"
      >
        {resendState === 'sent' ? 'New code sent' : resendState === 'sending' ? 'Sending…' : 'Resend code'}
      </button>
    </form>
  );
}
