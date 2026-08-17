import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AssignmentPanel } from '@/components/tutor/AssignmentPanel';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { YouTubeEmbed } from '@/components/programs/YouTubeEmbed';
import { LessonViewTracker } from '@/components/programs/LessonViewTracker';
import { QuizLesson } from '@/components/programs/QuizLesson';
import { MarkCompleteButton } from '@/components/programs/MarkCompleteButton';

const LESSON_TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  reading: 'Reading',
  case_study: 'Case study',
  quiz: 'Quiz',
  puzzle: 'Exercise',
};

// Curriculum content is public read data with no learner-specific access rule,
// but this project's Supabase instance has RLS on with no policies defined yet
// (see packages/supabase/README.md) — the anon key can't read anything until
// policies exist. Using the admin client here is the same pattern already used
// elsewhere: trusted server-side code bypasses RLS rather than the browser
// talking to Supabase directly with an anon key that currently can't do
// anything.
export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: node } = await supabase
    .from('curriculum_nodes')
    .select('id, course_id, title, markdown_content, video_url, lesson_type, week_id')
    .eq('slug', slug)
    .maybeSingle();

  if (!node) notFound();

  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const [{ data: course }, { data: weeks }, { data: allNodes }, { data: completions }] = await Promise.all([
    supabase.from('courses').select('slug, title').eq('id', node.course_id).maybeSingle(),
    supabase
      .from('course_weeks')
      .select('id, week_number, title, is_final_assessment')
      .eq('course_id', node.course_id)
      .order('week_number', { ascending: true }),
    supabase
      .from('curriculum_nodes')
      .select('id, title, slug, sequence_order, week_id, lesson_type')
      .eq('course_id', node.course_id),
    user
      ? supabase.from('lesson_completions').select('node_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] as { node_id: string }[] }),
  ]);

  const completedIds = new Set((completions ?? []).map((c) => c.node_id));

  // Flatten into course order (week_number, then sequence_order within the
  // week) so Previous/Next and unlocking both work across week boundaries.
  const weekOrder = new Map((weeks ?? []).map((w, i) => [w.id, i]));
  const flat = [...(allNodes ?? [])].sort((a, b) => {
    const wa = a.week_id ? (weekOrder.get(a.week_id) ?? 999) : 999;
    const wb = b.week_id ? (weekOrder.get(b.week_id) ?? 999) : 999;
    if (wa !== wb) return wa - wb;
    return a.sequence_order - b.sequence_order;
  });
  const currentIndex = flat.findIndex((n) => n.id === node.id);
  const prevNode = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const nextNode = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

  // Locked if any earlier lesson in the course isn't complete yet — can't
  // skip ahead, matching the Canvas-style sequential structure. Signed-out
  // visitors just see content unlocked (nothing to gate against yet).
  const isLocked = user ? flat.slice(0, currentIndex).some((n) => !completedIds.has(n.id)) : false;
  const isComplete = completedIds.has(node.id);

  const currentWeek = (weeks ?? []).find((w) => w.id === node.week_id) ?? null;
  const weekNodes = currentWeek ? flat.filter((n) => n.week_id === currentWeek.id) : [];

  const sidebar = (
    <aside className="w-64 shrink-0">
      {course?.slug && (
        <Link href={`/programs/${course.slug}`} className="text-sm font-medium text-tan hover:text-ink">
          ← {course.title}
        </Link>
      )}
      {currentWeek && (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink/50">
            {currentWeek.is_final_assessment ? 'Final' : `Week ${currentWeek.week_number}`}
          </p>
          <p className="mt-1 font-serif text-base font-semibold text-ink">{currentWeek.title}</p>
          <nav className="mt-4 flex flex-col gap-1">
            {weekNodes.map((n) => {
              const isCurrent = n.id === node.id;
              const nIndex = flat.findIndex((f) => f.id === n.id);
              const nLocked = user ? flat.slice(0, nIndex).some((f) => !completedIds.has(f.id)) : false;
              const nDone = completedIds.has(n.id);
              return (
                <Link
                  key={n.id}
                  href={nLocked ? '#' : `/learn/${n.slug}`}
                  aria-disabled={nLocked}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
                    isCurrent ? 'bg-gold/10 font-medium text-ink' : nLocked ? 'text-ink/30' : 'text-ink/60 hover:bg-card'
                  }`}
                >
                  <span className="w-4 shrink-0 text-center">{nDone ? '✓' : nLocked ? '🔒' : ''}</span>
                  {n.title}
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </aside>
  );

  const lessonNav = (
    <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
      {prevNode ? (
        <Link href={`/learn/${prevNode.slug}`} className="text-sm font-medium text-ink/70 hover:text-ink">
          ← {prevNode.title}
        </Link>
      ) : (
        <span />
      )}
      {nextNode &&
        (isComplete ? (
          <Link
            href={`/learn/${nextNode.slug}`}
            className="rounded bg-gold px-5 py-2.5 text-sm font-semibold text-ink"
          >
            Next: {nextNode.title} →
          </Link>
        ) : (
          <span className="text-sm text-ink/40" title="Complete this lesson to unlock the next one">
            Next: {nextNode.title} 🔒
          </span>
        ))}
    </div>
  );

  if (isLocked) {
    return (
      <>
        <SiteHeader />
        <main className="flex w-full gap-10 pl-8 pr-6 py-10">
          {sidebar}
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl border border-border bg-card px-8 py-14 text-center">
              <p className="font-serif text-xl font-semibold text-ink">🔒 Locked</p>
              <p className="mt-2 text-sm text-ink/60">
                Complete the earlier lessons in this program first — pick up where you left off from the sidebar.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (node.lesson_type === 'quiz') {
    const { data: questions } = await supabase
      .from('quiz_questions')
      .select('id, question, options, correct_index, explanation')
      .eq('node_id', node.id)
      .order('sequence_order', { ascending: true });

    return (
      <>
        <SiteHeader />
        <LessonViewTracker courseId={node.course_id} nodeId={node.id} />
        <main className="flex w-full gap-10 pl-8 pr-6 py-10">
          {sidebar}
          <div className="min-w-0 flex-1">
            <QuizLesson title={node.title} questions={questions ?? []} nodeId={node.id} alreadyDone={isComplete} />
            {lessonNav}
          </div>
        </main>
      </>
    );
  }

  const { data: assignment } = await supabase
    .from('course_assignments')
    .select('id, title, instructions_markdown, starter_code')
    .eq('node_id', node.id)
    .limit(1)
    .maybeSingle();

  const typeLabel = LESSON_TYPE_LABEL[node.lesson_type] ?? null;

  const article = (
    <article className="max-w-3xl space-y-4 leading-relaxed text-ink [&_code]:rounded [&_code]:bg-card [&_code]:px-1 [&_code]:py-0.5 [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:font-serif [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-ink [&_pre]:p-4 [&_pre]:text-background">
      {typeLabel && (
        <span className="inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-dark">
          {typeLabel}
        </span>
      )}
      {node.video_url && <YouTubeEmbed url={node.video_url} />}
      <ReactMarkdown>{node.markdown_content}</ReactMarkdown>
      {assignment && (
        <>
          <hr className="border-border" />
          <h2 className="font-serif text-xl font-semibold">{assignment.title}</h2>
          <ReactMarkdown>{assignment.instructions_markdown}</ReactMarkdown>
        </>
      )}
      {/* Assignment-backed lessons complete via grading (see /api/grade), not
          this button — the assignment panel already provides that signal. */}
      {!assignment && <MarkCompleteButton nodeId={node.id} alreadyDone={isComplete} />}
    </article>
  );

  return (
    <>
      <SiteHeader />
      <LessonViewTracker courseId={node.course_id} nodeId={node.id} />
      {assignment ? (
        <main className="flex w-full gap-10 pl-8 pr-6 py-10">
          {sidebar}
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-8 xl:grid-cols-2">
            <div>
              {article}
              {lessonNav}
            </div>
            <div className="xl:sticky xl:top-10 xl:h-[calc(100vh-5rem)]">
              <AssignmentPanel assignmentId={assignment.id} starterCode={assignment.starter_code ?? ''} />
            </div>
          </div>
        </main>
      ) : (
        <main className="flex w-full gap-10 pl-8 pr-6 py-10">
          {sidebar}
          <div className="min-w-0 flex-1">
            {article}
            {lessonNav}
          </div>
        </main>
      )}
    </>
  );
}
