import Link from 'next/link';
import Image from 'next/image';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { TalkToTutorButton } from '@/components/programs/TalkToTutorButton';
import { ProgramCard } from '@/components/programs/ProgramCard';
import { Faq } from '@/components/home/Faq';
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

  // Real, computed numbers — not hardcoded — so this stays accurate as
  // programs and content grow.
  const liveProgramCount = programs.filter((p) => p.status === 'live').length;
  const totalLessons = programs.reduce((sum, p) => sum + p.lessonCount, 0);
  const totalWeeks = programs.reduce((sum, p) => sum + p.weeks.filter((w) => !w.isFinal).length, 0);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero — the problem */}
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
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-tan">The problem</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-3 font-serif text-4xl font-semibold text-ink sm:text-5xl">
                A grade says &ldquo;passed.&rdquo; It doesn&apos;t say you can do it.
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mx-auto mt-5 max-w-xl text-lg text-ink/70">
                Most Kenyan students finish school or university with no reliable way to prove what they actually
                learned — and no clear next step either way.
              </p>
            </Reveal>
            <Reveal delay={320}>
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

        {/* Real numbers, mid-page */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-4 px-6 py-14 sm:grid-cols-4">
            <Reveal>
              <StatTile value={String(liveProgramCount)} label="Live programs" />
            </Reveal>
            <Reveal delay={80}>
              <StatTile value={String(totalLessons)} label="Real lessons" />
            </Reveal>
            <Reveal delay={160}>
              <StatTile value={String(totalWeeks)} label="Weeks of curriculum" />
            </Reveal>
            <Reveal delay={240}>
              <StatTile value="2×" label="Live tutor sessions / week" />
            </Reveal>
          </div>
        </section>

        {/* The solution */}
        <section className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-tan">The approach</span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-ink sm:text-4xl">
              Built to prove skill, not just pass time.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 text-lg text-ink/70">
              A live tutor that actually remembers you. A path you can&apos;t skip ahead in without proving mastery
              first. And a portfolio of real work — not a certificate asking someone to take your word for it.
            </p>
          </Reveal>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 sm:grid-cols-3">
            <Reveal>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <TutorIcon />
              </div>
              <h3 className="mt-4 font-serif text-xl font-semibold text-ink">A tutor that remembers you</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                Live, voice-based, one-on-one or small cohort — picking up exactly where your last session left off.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <PathIcon />
              </div>
              <h3 className="mt-4 font-serif text-xl font-semibold text-ink">A path, not a playlist</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                You don&apos;t move on until the last skill is genuinely mastered — verified by real assignments, not
                a watched video.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <ProofIcon />
              </div>
              <h3 className="mt-4 font-serif text-xl font-semibold text-ink">Proof that outlasts a transcript</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                Every learner leaves with a real, verifiable record of what they built — not just a grade.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Programs */}
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

        {/* FAQ */}
        <section className="border-t border-border bg-card px-6 py-16">
          <Reveal>
            <h2 className="text-center font-serif text-2xl font-semibold text-ink sm:text-3xl">
              Frequently asked questions
            </h2>
          </Reveal>
          <div className="mt-8">
            <Reveal delay={80}>
              <Faq />
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-serif text-3xl font-semibold text-ink sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink/50 sm:text-sm">{label}</p>
    </div>
  );
}

function TutorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="13" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 10.5l5-3v9l-5-3" />
    </svg>
  );
}

function PathIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="5" cy="6" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path strokeLinecap="round" d="M6.5 7.5L10.5 10.5M13.5 13.5L17.5 16.5" />
    </svg>
  );
}

function ProofIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
