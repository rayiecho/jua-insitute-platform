import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';

export const metadata = {
  title: 'Policies & Terms — Jua Institute',
};

export default function PoliciesPage() {
  return (
    <main className="pl-8 pr-6 py-16">
      <div className="max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-tan hover:text-ink">
          <LogoMark className="h-6 w-6" /> Jua Institute
        </Link>

        <h1 className="mt-8 font-serif text-3xl font-semibold text-ink">Policies & terms of use</h1>
        <p className="mt-2 text-sm text-ink/50">Last updated August 2026.</p>

        <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-ink/80">
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">What we collect when you enroll</h2>
            <p className="mt-2">
              When you apply to a program, we collect your name, email address, education level, weekly time
              commitment, and areas of interest. We use this to place you on the right track and to prepare your AI
              tutor for your first live class — nothing here is sold or shared with third parties for marketing.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Email verification</h2>
            <p className="mt-2">
              We verify your email once, at enrollment, with a one-time sign-in link. After that, you won&apos;t be
              asked to verify again — self-paced lessons and live classes both use the identity confirmed at that
              step.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Live classes</h2>
            <p className="mt-2">
              Live classes are taught by an AI tutor and are reserved for learners enrolled in a program. Sessions
              may be used to track your progress against the program curriculum. If you join without being enrolled,
              the tutor will direct you to enroll rather than teach an ad-hoc session.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Acceptable use</h2>
            <p className="mt-2">
              Programs, lessons, and live sessions are for your own learning. Don&apos;t share your enrollment email
              with others to access your account, and don&apos;t use the platform for anything unlawful or abusive
              toward the tutor or other learners.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Questions</h2>
            <p className="mt-2">
              Reach out to your program administrator with any questions about how your data is used or how to
              remove your enrollment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
