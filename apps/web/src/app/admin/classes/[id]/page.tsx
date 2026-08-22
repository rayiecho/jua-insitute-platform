import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

const CAT_OFFSET_HOURS = 2;

function formatCat(iso: string): string {
  const d = new Date(new Date(iso).getTime() + CAT_OFFSET_HOURS * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' CAT';
}

export default async function AdminClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const admin = createAdminClient();

  const { data: session } = await admin
    .from('class_sessions')
    .select('id, course_id, scheduled_start, duration_minutes, status, course:courses(title), week:course_weeks(week_number, title)')
    .eq('id', id)
    .maybeSingle();

  if (!session) notFound();
  const course = Array.isArray(session.course) ? session.course[0] : session.course;
  const week = Array.isArray(session.week) ? session.week[0] : session.week;

  const [{ data: assigned }, { data: enrolledInCourse }] = await Promise.all([
    admin
      .from('class_session_enrollments')
      .select('user_id, joined_at, learner:platform_users(first_name, last_name, email)')
      .eq('class_session_id', id),
    admin.from('enrollments').select('user_id, learner:platform_users(id, first_name, last_name, email)').eq('course_id', session.course_id),
  ]);

  const assignedIds = new Set((assigned ?? []).map((a) => a.user_id));
  const candidates = (enrolledInCourse ?? [])
    .map((e) => (Array.isArray(e.learner) ? e.learner[0] : e.learner))
    .filter((l): l is { id: string; first_name: string; last_name: string; email: string } => !!l && !assignedIds.has(l.id));

  return (
    <div className="w-full max-w-3xl">
      <Link href="/admin/classes" className="text-sm font-medium text-tan hover:text-ink">
        ← All classes
      </Link>

      <h1 className="mt-3 font-serif text-2xl font-semibold text-ink">{course?.title ?? 'Class'}</h1>
      <p className="mt-1 text-sm text-ink/60">
        {formatCat(session.scheduled_start)} · {session.duration_minutes} min
        {week ? ` · Week ${week.week_number}: ${week.title}` : ''}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Assigned learners ({assigned?.length ?? 0})</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody>
            {(assigned ?? []).map((a) => {
              const learner = Array.isArray(a.learner) ? a.learner[0] : a.learner;
              return (
                <tr key={a.user_id} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-2 text-ink">
                    {learner?.first_name} {learner?.last_name}
                  </td>
                  <td className="px-4 py-2 text-ink/60">{learner?.email}</td>
                  <td className="px-4 py-2 text-ink/40">{a.joined_at ? 'Joined' : 'Not joined yet'}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={`/api/admin/classes/${id}/enrollments/remove`} method="post">
                      <input type="hidden" name="userId" value={a.user_id} />
                      <button type="submit" className="text-xs font-medium text-red-600 hover:text-red-800">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(!assigned || assigned.length === 0) && (
              <tr>
                <td className="px-4 py-4 text-center text-ink/50" colSpan={4}>
                  No learners assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Add learners enrolled in {course?.title}</h2>
      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-ink/50">Everyone enrolled in this program is already assigned.</p>
      ) : (
        <form action={`/api/admin/classes/${id}/enrollments`} method="post" className="mt-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="userIds" value={c.id} />
                        <span className="text-ink">
                          {c.first_name} {c.last_name}
                        </span>
                        <span className="text-ink/50">{c.email}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="mt-3 rounded bg-gold px-4 py-2 text-sm font-semibold text-ink">
            Add selected
          </button>
        </form>
      )}
    </div>
  );
}
