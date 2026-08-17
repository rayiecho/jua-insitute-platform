import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { EnrollAndStartButton } from '@/components/programs/EnrollAndStartButton';

const LESSON_TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  reading: 'Reading',
  case_study: 'Case study',
  quiz: 'Quiz',
  puzzle: 'Exercise',
};

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from('courses')
    .select('id, title, description, tagline, difficulty_level')
    .eq('slug', slug)
    .eq('status', 'live')
    .maybeSingle();

  if (!course) notFound();

  const { data: weeks } = await supabase
    .from('course_weeks')
    .select('id, week_number, title, summary, is_final_assessment')
    .eq('course_id', course.id)
    .order('week_number', { ascending: true });

  const { data: nodes } = await supabase
    .from('curriculum_nodes')
    .select('id, title, slug, sequence_order, week_id, lesson_type')
    .eq('course_id', course.id)
    .order('sequence_order', { ascending: true });

  const nodesByWeek = new Map<string, typeof nodes>();
  const unweekedNodes: typeof nodes = [];
  for (const node of nodes ?? []) {
    if (node.week_id) {
      const list = nodesByWeek.get(node.week_id) ?? [];
      list.push(node);
      nodesByWeek.set(node.week_id, list);
    } else {
      unweekedNodes.push(node);
    }
  }

  const firstNode = (weeks ?? []).length > 0 ? nodesByWeek.get(weeks![0].id)?.[0] : unweekedNodes[0];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <span className="text-xs font-semibold tracking-wide text-tan uppercase">{course.difficulty_level}</span>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">{course.title}</h1>
        {course.tagline && <p className="mt-2 text-lg text-ink/70">{course.tagline}</p>}
        <p className="mt-4 text-ink/70">{course.description}</p>

        {firstNode && (
          <EnrollAndStartButton
            courseId={course.id}
            firstLessonHref={`/learn/${firstNode.slug}`}
            className="mt-8 inline-flex items-center rounded bg-gold px-6 py-3 text-sm font-semibold text-ink"
          />
        )}

        {weeks && weeks.length > 0 ? (
          <div className="mt-12 space-y-8">
            <h2 className="font-serif text-xl font-semibold text-ink">Program structure</h2>
            {weeks.map((week) => {
              const weekNodes = nodesByWeek.get(week.id) ?? [];
              return (
                <div key={week.id}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-lg font-semibold text-tan">
                      {week.is_final_assessment ? 'Final' : `Week ${week.week_number}`}
                    </span>
                    <h3 className="font-serif text-lg font-semibold text-ink">{week.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{week.summary}</p>

                  {weekNodes.length > 0 ? (
                    <ol className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                      {weekNodes.map((node) => (
                        <li key={node.id}>
                          <Link
                            href={`/learn/${node.slug}`}
                            className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-background"
                          >
                            <span className="font-medium text-ink">{node.title}</span>
                            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink/40">
                              {LESSON_TYPE_LABEL[node.lesson_type] ?? node.lesson_type}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm italic text-ink/40">Content coming soon.</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          unweekedNodes.length > 0 && (
            <div className="mt-12">
              <h2 className="font-serif text-xl font-semibold text-ink">Syllabus</h2>
              <ol className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
                {unweekedNodes.map((node, i) => (
                  <li key={node.id}>
                    <Link href={`/learn/${node.slug}`} className="flex items-center gap-4 px-5 py-4 hover:bg-background">
                      <span className="font-serif text-lg text-tan">{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-medium text-ink">{node.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )
        )}
      </main>
    </>
  );
}
