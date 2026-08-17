import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { EnrollAndStartButton } from '@/components/programs/EnrollAndStartButton';
import { ProgramSyllabus } from '@/components/programs/ProgramSyllabus';

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

  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const [{ data: weeks }, { data: nodes }, { data: completions }] = await Promise.all([
    supabase
      .from('course_weeks')
      .select('id, week_number, title, summary, is_final_assessment')
      .eq('course_id', course.id)
      .order('week_number', { ascending: true }),
    supabase
      .from('curriculum_nodes')
      .select('id, title, slug, sequence_order, week_id, lesson_type')
      .eq('course_id', course.id)
      .order('sequence_order', { ascending: true }),
    user
      ? supabase.from('lesson_completions').select('node_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] as { node_id: string }[] }),
  ]);

  const completedIds = (completions ?? []).map((c) => c.node_id);
  const completedSet = new Set(completedIds);

  const nodesByWeek = new Map<string, NonNullable<typeof nodes>>();
  const unweekedNodes: NonNullable<typeof nodes> = [];
  for (const node of nodes ?? []) {
    if (node.week_id) {
      const list = nodesByWeek.get(node.week_id) ?? [];
      list.push(node);
      nodesByWeek.set(node.week_id, list);
    } else {
      unweekedNodes.push(node);
    }
  }

  // Flat course order (week, then sequence within week) to compute which
  // lessons are locked — same rule as /learn/[slug]: can't skip ahead of an
  // incomplete earlier lesson.
  const weekOrderIndex = new Map((weeks ?? []).map((w, i) => [w.id, i]));
  const flat = [...(nodes ?? [])].sort((a, b) => {
    const wa = a.week_id ? (weekOrderIndex.get(a.week_id) ?? 999) : 999;
    const wb = b.week_id ? (weekOrderIndex.get(b.week_id) ?? 999) : 999;
    if (wa !== wb) return wa - wb;
    return a.sequence_order - b.sequence_order;
  });
  const lockedIds = user
    ? flat.filter((n, i) => flat.slice(0, i).some((earlier) => !completedSet.has(earlier.id))).map((n) => n.id)
    : [];

  const firstNode = (weeks ?? []).length > 0 ? nodesByWeek.get(weeks![0].id)?.[0] : unweekedNodes[0];

  const nodesByWeekObj: Record<string, NonNullable<typeof nodes>> = {};
  for (const [weekId, list] of nodesByWeek) nodesByWeekObj[weekId] = list;

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

        {weeks && weeks.length > 0 && (
          <ProgramSyllabus
            weeks={weeks}
            nodesByWeek={nodesByWeekObj}
            completedIds={completedIds}
            lockedIds={lockedIds}
          />
        )}
      </main>
    </>
  );
}
