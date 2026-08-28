import Link from 'next/link';
import Image from 'next/image';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { TalkToTutorButton } from '@/components/programs/TalkToTutorButton';
import { ProgramCard } from '@/components/programs/ProgramCard';
import { Reveal } from '@/components/layout/Reveal';

// Without this, Next.js prerenders the program teaser once at build time and
// never re-queries it — new programs or status changes wouldn't show up
// without a redeploy.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createAdminClient();

  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const { data: enrollments } = user
    ? await supabase.from('enrollments').select('course_id').eq('user_id', user.id)
    : { data: [] as { course_id: string }[] };
  const enrolledCourseIds = (enrollments ?? []).map((e) => e.course_id);

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, description, tagline, difficulty_level, status, slug')
    .order('created_at', { ascending: true })
    .limit(4);

  const { data: nodes } = await supabase.from('curriculum_nodes').select('course_id');
  const lessonCounts = new Map<string, number>();
  for (const node of nodes ?? []) {
    lessonCounts.set(node.course_id, (lessonCounts.get(node.course_id) ?? 0) + 1);
  }

  const weeksByCourse = new Map<string, { weekNumber: number; title: string; isFinal: boolean }[]>();
  const { data: weeks } = await supabase
    .from('course_weeks')
    .select('course_id, week_number, title, is_final_assessment')
    .order('week_number', { ascending: true });
  for (const w of weeks ?? []) {
    const list = weeksByCourse.get(w.course_id) ?? [];
    list.push({ weekNumber: w.week_number, title: w.title, isFinal: w.is_final_assessment });
    weeksByCourse.set(w.course_id, list);
  }

  const programs = (courses ?? []).map((c) => ({
    ...c,
    lessonCount: lessonCounts.get(c.id) ?? 0,
    weeks: weeksByCourse.get(c.id) ?? [],
  }));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section>
          <Reveal>
            <div className="relative h-[60vh] min-h-[420px] w-full">
              <Image
                src="https://pub-aefea01aecc44a379842b04ac827cd6a.r2.dev/output/brandimg_1787926154.jpg"
                alt="Jua Institute"
                fill
                priority
                className="object-cover"
              />
            </div>
          </Reveal>
          <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-16 text-center">
            <Reveal>
              <h1 className="font-serif text-4xl font-semibold text-ink sm:text-5xl">
                A real class. A tutor who never forgets where you are.
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mx-auto mt-5 max-w-xl text-lg text-ink/70">
                Jua Institute pairs project-based, self-paced programs with a live 1-on-1 AI tutor —
                the same one every session, who already knows what you were building last time.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/programs"
                  className="rounded bg-gold px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold-dark"
                >
                  Explore programs
                </Link>
                <TalkToTutorButton className="rounded border border-border px-6 py-3 text-sm font-semibold text-ink hover:bg-card" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
            <Reveal>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <PlatformIcon />
              </div>
              <span className="mt-4 block text-xs font-semibold uppercase tracking-wide text-tan">The platform</span>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">Learn at your own pace</h2>
              <p className="mt-3 text-ink/70">
                Real lessons, seeded videos, and a live code sandbox — not slides. Work through a
                program on your own schedule, submit assignments, and get graded automatically:
                syntax errors come back instantly, real logic gets a full review.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <LiveClassIcon />
              </div>
              <span className="mt-4 block text-xs font-semibold uppercase tracking-wide text-tan">The live class</span>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">Then talk it through</h2>
              <p className="mt-3 text-ink/70">
                Jump into a live voice session with your tutor anytime. It already knows your
                current lesson and reacts to your code as you write it — no re-explaining where
                you left off.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Programs teaser */}
        {programs.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:px-8">
            <Reveal>
              <div className="flex items-end justify-between px-2">
                <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Programs</h2>
                <Link href="/programs" className="text-sm font-medium text-tan hover:text-ink">
                  View all →
                </Link>
              </div>
            </Reveal>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {programs.map((program, i) => (
                <Reveal key={program.id} delay={i * 80}>
                  <ProgramCard program={program} enrolled={enrolledCourseIds.includes(program.id)} />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function PlatformIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
    </svg>
  );
}

function LiveClassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="13" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 10.5l5-3v9l-5-3" />
    </svg>
  );
}
