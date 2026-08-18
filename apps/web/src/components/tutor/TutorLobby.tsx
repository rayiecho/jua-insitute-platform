'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { ClassroomShell } from './ClassroomShell';
import { TutorSessionRoom } from './TutorSessionRoom';
import { OtpVerifyForm } from '@/components/auth/OtpVerifyForm';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { Learner } from '@/lib/learner';

type Status = 'idle' | 'checking' | 'not_found' | 'not_verified' | 'not_enrolled' | 'ready' | 'in-session';

// The live-class entry ritual — deliberately independent of the browser's
// auth session. A learner types their first name and email every time; the
// tutor is resolved from that against platform_users (verified at
// enrollment, once — see EnrollmentForm / lib/auth/provision.ts), not from
// a signed-in cookie. If the email isn't recognized, isn't verified yet, or
// isn't enrolled in anything, this stops here with a clear next step —
// nothing ever reaches the room or the agent for someone who hasn't
// enrolled. "Not verified yet" sends a code right here (OtpVerifyForm)
// rather than sending them off to click an email link.
export function TutorLobby() {
  const [status, setStatus] = useState<Status>('idle');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [resolvedFirstName, setResolvedFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  async function checkStatus(emailToCheck: string) {
    const res = await fetch('/api/learner-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailToCheck }),
    });
    const data = await res.json();
    setStatus(data.status);
    if (data.status === 'ready') setResolvedFirstName(data.firstName || firstName);
    return data.status as Status;
  }

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setStatus('checking');
    setError(null);
    try {
      await checkStatus(email);
    } catch {
      setError('Could not check your enrollment — try again.');
      setStatus('idle');
    }
  }

  // Send a code the moment we land on "not verified" so the learner can
  // just type it without an extra click.
  useEffect(() => {
    if (status !== 'not_verified' || codeSent) return;
    setCodeSent(true);
    const supabase = createBrowserSupabaseClient();
    void supabase.auth.signInWithOtp({ email });
  }, [status, codeSent, email]);

  if (status === 'in-session') {
    const learner: Learner = { id: '', firstName: resolvedFirstName || firstName, lastName: '', email };
    return <TutorSessionRoom learner={learner} onLeave={() => setStatus('ready')} />;
  }

  return (
    <ClassroomShell>
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 py-16">
        <LogoMark className="h-12 w-12" />

        {(status === 'idle' || status === 'checking') && (
          <div className="mt-8 w-full">
            <h1 className="text-center font-serif text-2xl font-semibold text-ink">Join the live class</h1>
            <p className="mb-4 mt-2 text-center text-sm text-ink/60">
              Enter your first name and the email you enrolled with.
            </p>
            <form onSubmit={handleIdentify} className="flex flex-col gap-3">
              <input
                className="rounded border border-border bg-card px-3 py-2 text-ink"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <input
                className="rounded border border-border bg-card px-3 py-2 text-ink"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={status === 'checking' || !firstName.trim() || !email.trim()}
                className="rounded bg-gold px-3 py-2 font-semibold text-ink disabled:opacity-50"
              >
                {status === 'checking' ? 'Checking…' : 'Continue'}
              </button>
            </form>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {status === 'not_found' && (
          <NoticeCard
            title="We don't recognize that email"
            body="You need to enroll in a program before joining a live class — your tutor teaches from your actual curriculum, so there's nothing to coach on until you've started one."
            ctaHref="/programs"
            ctaLabel="Browse programs"
            onBack={() => setStatus('idle')}
          />
        )}

        {status === 'not_verified' && (
          <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
            <p className="font-serif text-xl font-semibold text-ink">Almost there</p>
            <p className="text-sm text-ink/60">We found your application — just verify your email to continue.</p>
            <OtpVerifyForm
              email={email}
              onVerified={async () => {
                setCodeSent(false);
                await checkStatus(email);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setStatus('idle');
              }}
              className="text-xs font-medium text-ink/50 hover:text-ink"
            >
              Try a different email
            </button>
          </div>
        )}

        {status === 'not_enrolled' && (
          <NoticeCard
            title="Not enrolled yet"
            body="You need to enroll in a program before joining a live class — your tutor teaches from your actual curriculum, so there's nothing to coach on until you've started one."
            ctaHref="/programs"
            ctaLabel="Browse programs"
            onBack={() => setStatus('idle')}
          />
        )}

        {status === 'ready' && (
          <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
            <p className="font-serif text-xl font-semibold text-ink">Ready, {resolvedFirstName}?</p>
            <p className="text-sm text-ink/60">Your tutor will be with you as soon as you join.</p>
            <button
              type="button"
              onClick={() => setStatus('in-session')}
              className="mt-2 w-full rounded bg-gold px-4 py-3 font-semibold text-ink"
            >
              Join class
            </button>
          </div>
        )}
      </main>
    </ClassroomShell>
  );
}

function NoticeCard({
  title,
  body,
  ctaHref,
  ctaLabel,
  onBack,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  onBack: () => void;
}) {
  return (
    <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
      <p className="font-serif text-xl font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink/60">{body}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="mt-2 rounded bg-gold px-6 py-3 font-semibold text-ink">
          {ctaLabel}
        </Link>
      )}
      <button type="button" onClick={onBack} className="text-xs font-medium text-ink/50 hover:text-ink">
        Try a different email
      </button>
    </div>
  );
}
