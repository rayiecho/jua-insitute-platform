import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminEnrollmentsPage() {
  const supabase = createAdminClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(
      'id, enrolled_at, last_viewed_at, learner:platform_users(first_name, last_name, email), course:courses(title)',
    )
    .order('enrolled_at', { ascending: false });

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Enrollments</h1>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left">
            <tr>
              <th className="px-4 py-2">Learner</th>
              <th className="px-4 py-2">Program</th>
              <th className="px-4 py-2">Enrolled</th>
              <th className="px-4 py-2">Last active</th>
            </tr>
          </thead>
          <tbody>
            {(enrollments ?? []).map((e) => {
              const learner = Array.isArray(e.learner) ? e.learner[0] : e.learner;
              const course = Array.isArray(e.course) ? e.course[0] : e.course;
              return (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2 text-ink">
                    {learner ? `${learner.first_name} ${learner.last_name}` : '—'}
                    <span className="ml-2 text-xs text-ink/40">{learner?.email}</span>
                  </td>
                  <td className="px-4 py-2 text-ink/70">{course?.title ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-ink/50">{new Date(e.enrolled_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs text-ink/50">
                    {e.last_viewed_at ? new Date(e.last_viewed_at).toLocaleDateString() : 'Never opened a lesson'}
                  </td>
                </tr>
              );
            })}
            {(!enrollments || enrollments.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={4}>
                  No enrollments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
