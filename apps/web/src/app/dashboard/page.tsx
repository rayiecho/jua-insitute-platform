import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SiteHeader } from '@/components/layout/SiteHeader';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) redirect('/programs');

  const admin = createAdminClient();

  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id, enrolled_at, last_viewed_at, last_viewed_node_id, course:courses(title, slug)')
    .eq('user_id', user.id)
    .order('last_viewed_at', { ascending: false, nullsFirst: false });

  const courseIds = (enrollments ?? []).map((e) => e.course_id);

  const [{ data: allNodes }, { data: completions }] = await Promise.all([
    courseIds.length > 0
      ? admin.from('curriculum_nodes').select('id, course_id, slug, sequence_order, week_id').in('course_id', courseIds)
      : Promise.resolve({ data: [] as { id: string; course_id: string; slug: string; sequence_order: number; week_id: string | null }[] }),
    admin.from('lesson_completions').select('node_id').eq('user_id', user.id),
  ]);

  const completedIds = new Set((completions ?? []).map((c) => c.node_id));
  const nodesByCourse = new Map<string, typeof allNodes>();
  for (const node of allNodes ?? []) {
    const list = nodesByCourse.get(node.course_id) ?? [];
    list.push(node);
    nodesByCourse.set(node.course_id, list);
  }

  return (
    <>
      <SiteHeader />
      <main className="w-full max-w-4xl flex-1 pl-8 pr-6 py-10">
        <h1 className="font-serif text-3xl font-semibold text-ink">Your programs</h1>

        {(!enrollments || enrollments.length === 0) && (
          <div className="mt-8 rounded-2xl border border-border bg-card px-8 py-14 text-center">
            <p className="text-ink/60">You haven&apos;t enrolled in a program yet.</p>
            <Link href="/programs" className="mt-4 inline-flex rounded bg-gold px-6 py-3 text-sm font-semibold text-ink">
              Browse programs
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(enrollments ?? []).map((enrollment) => {
            const course = Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course;
            const courseNodes = nodesByCourse.get(enrollment.course_id) ?? [];
            const doneCount = courseNodes.filter((n) => completedIds.has(n.id)).length;
            const total = courseNodes.length;
            const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
            const continueNode = courseNodes.find((n) => n.id === enrollment.last_viewed_node_id) ?? courseNodes[0];

            return (
              <div key={enrollment.course_id} className="rounded-lg border border-border bg-card p-6">
                <h2 className="font-serif text-xl font-semibold text-ink">{course?.title ?? 'Program'}</h2>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-ink/50">
                  {doneCount}/{total} lessons complete
                </p>
                {continueNode && (
                  <Link
                    href={`/learn/${continueNode.slug}`}
                    className="mt-4 inline-flex rounded bg-gold px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Continue
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
