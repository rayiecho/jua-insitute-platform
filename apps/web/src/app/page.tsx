import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { TalkToTutorButton } from '@/components/programs/TalkToTutorButton';

// Without this, Next.js prerenders the program teaser once at build time and
// never re-queries it — new programs or status changes wouldn't show up
// without a redeploy.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createAdminClient();
  const { data: courses } = await supabase
    .from('courses')
    .select('title, tagline, status, slug')
    .order('created_at', { ascending: true })
    .limit(2);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-3xl px-6 pt-20 pb-16 text-center">
          <h1 className="font-serif text-4xl font-semibold text-ink sm:text-5xl">
            A real class. A tutor who never forgets where you are.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink/70">
            Jua Institute pairs project-based, self-paced programs with a live 1-on-1 AI tutor —
            the same one every session, who already knows what you were building last time.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/programs"
              className="rounded bg-gold px-6 py-3 text-sm font-semibold text-ink"
            >
              Explore programs
            </Link>
            <TalkToTutorButton className="rounded border border-border px-6 py-3 text-sm font-semibold text-ink hover:bg-card" />
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-tan">The platform</span>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Learn at your own pace</h2>
              <p className="mt-3 text-ink/70">
                Real lessons, seeded videos, and a live code sandbox — not slides. Work through a
                program on your own schedule, submit assignments, and get graded automatically:
                syntax errors come back instantly, real logic gets a full review.
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-tan">The live class</span>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">Then talk it through</h2>
              <p className="mt-3 text-ink/70">
                Jump into a live voice session with your tutor anytime. It already knows your
                current lesson and reacts to your code as you write it — no re-explaining where
                you left off.
              </p>
            </div>
          </div>
        </section>

        {/* Programs teaser */}
        {courses && courses.length > 0 && (
          <section className="mx-auto w-full max-w-5xl px-6 py-16">
            <div className="flex items-end justify-between">
              <h2 className="font-serif text-2xl font-semibold text-ink">Programs</h2>
              <Link href="/programs" className="text-sm font-medium text-tan hover:text-ink">
                View all →
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {courses.map((course) => (
                <Link
                  key={course.title}
                  href="/programs"
                  className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-gold"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                    {course.status === 'live' ? 'Live now' : 'Coming soon'}
                  </span>
                  <h3 className="mt-1 font-serif text-xl font-semibold text-ink">{course.title}</h3>
                  {course.tagline && <p className="mt-1 text-sm text-ink/60">{course.tagline}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
