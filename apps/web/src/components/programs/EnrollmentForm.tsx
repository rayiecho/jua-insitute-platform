'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { OtpVerifyForm } from '@/components/auth/OtpVerifyForm';

const EDUCATION_LEVELS = ['High school', 'Undergraduate', 'Graduate', 'Working professional', 'Other'];
const COMMITMENT_OPTIONS = ['2–4 hrs/week', '5–7 hrs/week', '8–10 hrs/week', '10+ hrs/week'];
const INTEREST_OPTIONS = [
  'Starting my own business',
  'Growing an existing business',
  'Product & tech skills',
  'Career change',
  'Investing & finance',
  'Leadership & management',
];

// The real "I'm enrolling" form (Section 4.4 — this is what makes the tutor
// coach on THIS course rather than guessing). Two steps under the hood:
// stage the application (POST /api/enroll-application, visible to admin
// immediately) then send a one-time code the learner types right here —
// see components/auth/OtpVerifyForm.tsx for why a typed code replaced the
// email-link click entirely. The actual enrollment row isn't created until
// that code is verified (see lib/auth/provision.ts), so a
// submitted-but-unverified application doesn't yet count as "enrolled."
export function EnrollmentForm({ courseId, className }: { courseId: string; className?: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [commitmentHours, setCommitmentHours] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(option: string) {
    setInterests((prev) => (prev.includes(option) ? prev.filter((i) => i !== option) : [...prev, option]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/enroll-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          courseId,
          educationLevel,
          commitmentHours,
          interests: interests.join(', '),
          policyAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit application');

      const supabase = createBrowserSupabaseClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { data: { first_name: firstName, last_name: lastName } },
      });
      if (otpError) throw otpError;

      setAwaitingCode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (awaitingCode) {
    return (
      <div className={className}>
        <OtpVerifyForm email={email} onVerified={(redirectTo) => router.push(redirectTo)} />
      </div>
    );
  }

  const canSubmit =
    firstName.trim() && lastName.trim() && email.trim() && educationLevel && commitmentHours && policyAccepted;

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-4 ${className ?? ''}`}>
      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <input
        className="rounded border border-border bg-card px-3 py-2 text-ink"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50">
          Education level
        </label>
        <select
          className="w-full rounded border border-border bg-card px-3 py-2 text-ink"
          value={educationLevel}
          onChange={(e) => setEducationLevel(e.target.value)}
          required
        >
          <option value="" disabled>
            Select one
          </option>
          {EDUCATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50">
          Weekly time commitment
        </label>
        <select
          className="w-full rounded border border-border bg-card px-3 py-2 text-ink"
          value={commitmentHours}
          onChange={(e) => setCommitmentHours(e.target.value)}
          required
        >
          <option value="" disabled>
            Select one
          </option>
          {COMMITMENT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/50">
          Areas of interest
        </label>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => toggleInterest(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                interests.includes(option)
                  ? 'border-gold bg-gold text-ink'
                  : 'border-border bg-card text-ink/70 hover:bg-background'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-ink/60">
        <input
          type="checkbox"
          checked={policyAccepted}
          onChange={(e) => setPolicyAccepted(e.target.checked)}
          className="mt-0.5"
          required
        />
        <span>
          I agree to the{' '}
          <Link href="/terms" target="_blank" className="font-medium text-tan hover:text-ink">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" className="font-medium text-tan hover:text-ink">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="rounded bg-gold px-4 py-3 font-semibold text-ink disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Apply & verify email'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
