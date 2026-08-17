import { createAdminClient } from '@/lib/supabase/admin';

const STATUS_STYLE: Record<string, string> = {
  in_progress: 'text-ink/50',
  needs_revision: 'text-red-600',
  graded: 'text-gold-dark',
};

export default async function AdminSubmissionsPage() {
  const supabase = createAdminClient();

  const { data: submissions } = await supabase
    .from('student_assignments_progress')
    .select(
      'id, grading_status, score_achieved, updated_at, learner:platform_users(first_name, last_name, email), assignment:course_assignments(title, max_score)',
    )
    .order('updated_at', { ascending: false })
    .limit(200);

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Submissions</h1>
      <p className="mt-1 text-sm text-ink/60">Most recent 200 assignment submissions, across all programs.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left">
            <tr>
              <th className="px-4 py-2">Learner</th>
              <th className="px-4 py-2">Assignment</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Score</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(submissions ?? []).map((s) => {
              const learner = Array.isArray(s.learner) ? s.learner[0] : s.learner;
              const assignment = Array.isArray(s.assignment) ? s.assignment[0] : s.assignment;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 text-ink">
                    {learner ? `${learner.first_name} ${learner.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-ink/70">{assignment?.title ?? '—'}</td>
                  <td className={`px-4 py-2 font-medium ${STATUS_STYLE[s.grading_status] ?? ''}`}>
                    {s.grading_status}
                  </td>
                  <td className="px-4 py-2 text-ink/70">
                    {s.score_achieved !== null ? `${s.score_achieved}/${assignment?.max_score ?? '?'}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink/50">{new Date(s.updated_at).toLocaleString()}</td>
                </tr>
              );
            })}
            {(!submissions || submissions.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={5}>
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
