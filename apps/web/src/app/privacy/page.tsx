import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';

export const metadata = {
  title: 'Privacy Policy — Jua Institute',
};

export default function PrivacyPage() {
  return (
    <main className="pl-8 pr-6 py-16">
      <div className="max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-tan hover:text-ink">
          <LogoMark className="h-6 w-6" /> Jua Institute
        </Link>

        <h1 className="mt-8 font-serif text-3xl font-semibold text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink/50">Last updated August 2026.</p>

        <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-ink/80">
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">What we collect</h2>
            <p className="mt-2">When you apply to a program, we collect:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your name and email address, used to verify you and identify you across sessions.</li>
              <li>Your education level, weekly time commitment, and areas of interest, used to place you appropriately.</li>
              <li>
                Your progress through lessons and assignments — which lessons you&apos;ve completed, code you submit for
                grading, and the AI feedback you receive.
              </li>
              <li>Live class audio, processed in real time to power the AI tutor — see &quot;Live classes&quot; below.</li>
            </ul>
            <p className="mt-2">
              We don&apos;t collect payment information, and we don&apos;t use tracking cookies for advertising.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Live classes and the AI tutor</h2>
            <p className="mt-2">
              During a live class, your microphone audio is streamed in real time to our voice infrastructure so the
              AI tutor can hear and respond to you. That audio is processed by our speech-to-text and text-to-speech
              providers and by the language model that powers the tutor&apos;s responses — it is not permanently
              stored as audio. If an avatar is enabled for your class, your tutor&apos;s spoken responses (not your
              own voice) are also sent to our avatar rendering provider to generate synchronized video.
            </p>
            <p className="mt-2">
              A summary of what was covered in a live class may be saved to your learner record so the tutor can
              reference it in future sessions — this is how the tutor is able to pick up where you left off.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Who processes your data</h2>
            <p className="mt-2">
              We rely on a small number of infrastructure providers to run the platform, each processing only what
              they need to do their job: our database and authentication provider, our email delivery provider (for
              enrollment verification codes), our live video/audio infrastructure provider, our AI model providers
              (for tutoring and assignment grading), and a code-execution sandbox (for running and testing code you
              submit). None of these providers use your data for their own purposes — they process it on our behalf.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">What we don&apos;t do</h2>
            <p className="mt-2">
              We don&apos;t sell your data. We don&apos;t share it with advertisers. We don&apos;t use your submitted
              code, lesson answers, or class conversations to train third-party AI models beyond what&apos;s needed
              to generate your tutor&apos;s response or your assignment feedback in the moment.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Your rights</h2>
            <p className="mt-2">
              You can ask to see what data we hold about you, correct it, or have your enrollment and account removed
              entirely. Reach out to your program administrator to make any of these requests.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Changes to this policy</h2>
            <p className="mt-2">
              If this policy changes in a way that affects how your data is used, we&apos;ll update the date at the
              top of this page.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
