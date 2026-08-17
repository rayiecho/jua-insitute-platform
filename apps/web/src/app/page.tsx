import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { WaitlistForm } from '@/components/programs/WaitlistForm';

// Without this, Next.js prerenders the catalog once at build time and never
// re-queries it — new programs or status changes wouldn't show up without a
// redeploy.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createAdminClient();
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, description, tagline, difficulty_level, status, slug')
    .order('status', { ascending: true }) // 'coming_soon' > 'live' alphabetically is wrong; see below
    .order('created_at', { ascending: true });

  // 'live' sorts after 'coming_soon' alphabetically — flip client-side instead
  // of fighting Postgres text ordering for two known values.
  const ordered = [...(courses ?? [])].sort((a, b) => (a.status === b.status ? 0 : a.status === 'live' ? -1 : 1));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <div className="max-w-2xl">
          <h1 className="font-serif text-4xl font-semibold text-ink sm:text-5xl">
            Learn by doing, taught live.
          </h1>
          <p className="mt-4 text-lg text-ink/70">
            Practical, project-based programs — with an AI tutor that watches your work as you
            build, remembers every session, and picks up right where you left off.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {ordered.map((course) => (
            <div key={course.id} className="flex flex-col rounded-lg border border-border bg-card p-6">
              <span className="text-xs font-semibold tracking-wide text-tan uppercase">
                {course.difficulty_level}
              </span>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">{course.title}</h2>
              {course.tagline && <p className="mt-1 text-sm text-ink/60">{course.tagline}</p>}
              <p className="mt-3 flex-1 text-sm text-ink/70">{course.description}</p>

              {course.status === 'live' ? (
                <Link
                  href={`/programs/${course.slug}`}
                  className="mt-6 inline-flex w-fit items-center rounded bg-gold px-5 py-2.5 text-sm font-semibold text-ink"
                >
                  Start learning
                </Link>
              ) : (
                <div className="mt-6">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-ink/50 uppercase">Coming soon</p>
                  <WaitlistForm courseId={course.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
