import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';

export const metadata = {
  title: 'Terms of Use — Jua Institute',
};

export default function TermsPage() {
  return (
    <main className="px-4 py-10 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-tan hover:text-ink">
          <LogoMark className="h-6 w-6" /> Jua Institute
        </Link>

        <h1 className="mt-8 font-serif text-3xl font-semibold text-ink">Terms of Use</h1>
        <p className="mt-2 text-sm text-ink/50">Last updated August 2026.</p>

        <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-ink/80">
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Enrolling in a program</h2>
            <p className="mt-2">
              Enrollment requires a completed application and a verified email address, confirmed with a one-time
              code sent to you. That verification happens once — after that, you can start lessons and join live
              classes without re-verifying. Information you provide when applying (education level, weekly time
              commitment, areas of interest) is used to place you appropriately in the program, not shared outside
              Jua Institute.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Live classes</h2>
            <p className="mt-2">
              Live classes are taught by an AI tutor and reserved for learners enrolled in the relevant program.
              Sessions are capped in length and in how many can run at once, so a class ending on time or a join
              request being briefly delayed during busy periods is expected behavior, not a malfunction. If you join
              without being enrolled, or before verifying your email, you&apos;ll be directed to enroll instead of
              being taught an ad-hoc session.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Assignments and grading</h2>
            <p className="mt-2">
              Code and other work you submit for grading is executed in a sandboxed environment and reviewed by an AI
              model to generate a score and feedback. Submit your own work — grading is meant to reflect your actual
              understanding, and gaming it defeats the point of enrolling.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Your account</h2>
            <p className="mt-2">
              Your enrollment is tied to the email address you verified. Don&apos;t share it with others to access
              your account or attend live classes on your behalf — for live classes specifically, anyone who knows
              your enrolled email can currently join as you, so treat it like you would any other account credential.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Acceptable use</h2>
            <p className="mt-2">
              Programs, lessons, live sessions, and the support assistant are for your own learning. Don&apos;t use
              the platform for anything unlawful, abusive toward the tutor or other learners, or intended to disrupt
              the service for others.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Changes</h2>
            <p className="mt-2">
              We may update these terms as the platform changes. Continuing to use Jua Institute after an update
              means you accept the current terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Questions</h2>
            <p className="mt-2">
              See our{' '}
              <Link href="/privacy" className="font-medium text-tan hover:text-ink">
                Privacy Policy
              </Link>{' '}
              for how your data is handled, or reach out to your program administrator with any other questions.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
