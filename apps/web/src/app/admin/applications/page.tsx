import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminApplicationsPage() {
  const supabase = createAdminClient();

  const { data: applications } = await supabase
    .from('enrollment_applications')
    .select(
      'id, first_name, last_name, email, education_level, commitment_hours, interests, status, created_at, course:courses(title)',
    )
    .order('created_at', { ascending: false });

  return (
    <div className="w-full max-w-6xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Enrollment applications</h1>
      <p className="mt-1 text-sm text-ink/60">
        Submitted the moment someone applies to a program — &quot;verified&quot; means they&apos;ve confirmed their
        email and their enrollment is live.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Program</th>
              <th className="px-4 py-2">Education</th>
              <th className="px-4 py-2">Commitment</th>
              <th className="px-4 py-2">Interests</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Applied</th>
            </tr>
          </thead>
          <tbody>
            {(applications ?? []).map((a) => {
              const course = Array.isArray(a.course) ? a.course[0] : a.course;
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-2 text-ink">
                    {a.first_name} {a.last_name}
                  </td>
                  <td className="px-4 py-2 text-ink/70">{a.email}</td>
                  <td className="px-4 py-2 text-ink/70">{course?.title ?? '—'}</td>
                  <td className="px-4 py-2 text-ink/70">{a.education_level}</td>
                  <td className="px-4 py-2 text-ink/70">{a.commitment_hours}</td>
                  <td className="px-4 py-2 text-ink/70">{a.interests ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink/50">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {(!applications || applications.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={8}>
                  No applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
