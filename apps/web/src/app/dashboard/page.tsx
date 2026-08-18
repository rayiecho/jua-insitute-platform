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

  const [{ data: learner }, { data: enrollments }] = await Promise.all([
    admin.from('platform_users').select('first_name').eq('id', user.id).maybeSingle(),
    admin
      .from('enrollments')
      .select('course_id, enrolled_at, last_viewed_at, last_viewed_node_id, course:courses(title, slug)')
      .eq('user_id', user.id)
      .order('last_viewed_at', { ascending: false, nullsFirst: false }),
  ]);

  const courseIds = (enrollments ?? []).map((e) => e.course_id);

  const [{ data: allNodes }, { data: completions }, { data: submissions }] = await Promise.all([
    courseIds.length > 0
      ? admin.from('curriculum_nodes').select('id, course_id, slug, sequence_order, week_id').in('course_id', courseIds)
      : Promise.resolve({ data: [] as { id: string; course_id: string; slug: string; sequence_order: number; week_id: string | null }[] }),
    admin.from('lesson_completions').select('node_id').eq('user_id', user.id),
    // The actual "did the student do the work and what did the AI say"
    // record (Section: assignments + AI feedback) — previously this
    // dashboard never queried student_assignments_progress at all, so a
    // graded submission was invisible here even though grading itself
    // (apps/web/src/app/api/grade/route.ts) genuinely runs and writes to it.
    admin
      .from('student_assignments_progress')
      .select(
        'id, grading_status, score_achieved, ai_feedback_report, updated_at, assignment:course_assignments(title, max_score, node:curriculum_nodes(title, slug, course_id, course:courses(title)))',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ]);

  const completedIds = new Set((completions ?? []).map((c) => c.node_id));
  const nodesByCourse = new Map<string, typeof allNodes>();
  for (const node of allNodes ?? []) {
    const list = nodesByCourse.get(node.course_id) ?? [];
    list.push(node);
    nodesByCourse.set(node.course_id, list);
  }

  const gradedSubmissions = (submissions ?? []).filter((s) => s.grading_status === 'graded' && s.score_achieved != null);
  const avgScorePct =
    gradedSubmissions.length > 0
      ? Math.round(
          (gradedSubmissions.reduce((sum, s) => {
            const a = Array.isArray(s.assignment) ? s.assignment[0] : s.assignment;
            const max = a?.max_score || 100;
            return sum + (s.score_achieved ?? 0) / max;
          }, 0) /
            gradedSubmissions.length) *
            100,
        )
      : null;
  const totalLessonsDone = completedIds.size;

  return (
    <>
      <SiteHeader />
      <main className="w-full max-w-4xl flex-1 pl-8 pr-6 py-10">
        <h1 className="font-serif text-3xl font-semibold text-ink">
          {learner?.first_name ? `Hello, ${learner.first_name}` : 'Your dashboard'}
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          {totalLessonsDone > 0
            ? `You've completed ${totalLessonsDone} lesson${totalLessonsDone === 1 ? '' : 's'}. Keep going!`
            : "You haven't completed a lesson yet — let's get started."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Programs" value={String(enrollments?.length ?? 0)} />
          <StatCard label="Lessons done" value={String(totalLessonsDone)} />
          <StatCard label="Submissions" value={String(submissions?.length ?? 0)} />
          <StatCard label="Avg. score" value={avgScorePct != null ? `${avgScorePct}%` : '—'} />
        </div>

        <h2 className="mt-10 font-serif text-xl font-semibold text-ink">Continue learning</h2>

        {(!enrollments || enrollments.length === 0) && (
          <div className="mt-4 rounded-2xl border border-border bg-card px-8 py-14 text-center">
            <p className="text-ink/60">You haven&apos;t enrolled in a program yet.</p>
            <Link href="/programs" className="mt-4 inline-flex rounded bg-gold px-6 py-3 text-sm font-semibold text-ink">
              Browse programs
            </Link>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(enrollments ?? []).map((enrollment) => {
            const course = Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course;
            const courseNodes = nodesByCourse.get(enrollment.course_id) ?? [];
            const doneCount = courseNodes.filter((n) => completedIds.has(n.id)).length;
            const total = courseNodes.length;
            const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
            const continueNode = courseNodes.find((n) => n.id === enrollment.last_viewed_node_id) ?? courseNodes[0];

            return (
              <div key={enrollment.course_id} className="rounded-lg border border-border bg-card p-6">
                <h3 className="font-serif text-xl font-semibold text-ink">{course?.title ?? 'Program'}</h3>
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

        <h2 className="mt-10 font-serif text-xl font-semibold text-ink">Assignments & AI feedback</h2>

        {(!submissions || submissions.length === 0) && (
          <p className="mt-4 text-sm text-ink/60">
            Nothing submitted yet — assignments show up here as soon as you submit them for grading, with the AI&apos;s
            feedback.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {(submissions ?? []).map((s) => {
            const a = Array.isArray(s.assignment) ? s.assignment[0] : s.assignment;
            const node = Array.isArray(a?.node) ? a.node[0] : a?.node;
            const course = Array.isArray(node?.course) ? node.course[0] : node?.course;
            const statusLabel =
              s.grading_status === 'graded'
                ? `${s.score_achieved ?? 0}/${a?.max_score ?? 100}`
                : s.grading_status === 'in_progress'
                  ? 'In progress'
                  : s.grading_status ?? 'In progress';

            return (
              <div key={s.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-tan">{course?.title}</p>
                    <p className="mt-0.5 font-medium text-ink">{a?.title ?? 'Assignment'}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      s.grading_status === 'graded' ? 'bg-gold/20 text-ink' : 'bg-background text-ink/60'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                {s.ai_feedback_report && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">{s.ai_feedback_report}</p>
                )}
                {node?.slug && (
                  <Link href={`/learn/${node.slug}`} className="mt-3 inline-block text-xs font-medium text-tan hover:text-ink">
                    View lesson →
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <p className="font-serif text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/50">{label}</p>
    </div>
  );
}
