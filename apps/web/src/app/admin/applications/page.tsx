import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader, TableShell, Badge } from '@/components/admin/ui';

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
      <PageHeader
        title="Enrollment applications"
        description={`Submitted the moment someone applies to a program — "verified" means they've confirmed their email and their enrollment is live.`}
      />

      <TableShell>
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
                    <Badge tone={a.status === 'verified' ? 'green' : 'amber'}>{a.status}</Badge>
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
      </TableShell>
    </div>
  );
}
