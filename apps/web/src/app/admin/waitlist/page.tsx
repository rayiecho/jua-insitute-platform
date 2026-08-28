import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader, TableShell } from '@/components/admin/ui';

export default async function AdminWaitlistPage() {
  const supabase = createAdminClient();

  const { data: signups } = await supabase
    .from('waitlist_signups')
    .select('id, email, created_at, course:courses(title)')
    .order('created_at', { ascending: false });

  return (
    <div className="w-full max-w-5xl">
      <PageHeader title="Waitlist" />

      <TableShell>
        <thead className="bg-card text-left">
          <tr>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Program</th>
            <th className="px-4 py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
            {(signups ?? []).map((s) => {
              const course = Array.isArray(s.course) ? s.course[0] : s.course;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 text-ink">{s.email}</td>
                  <td className="px-4 py-2 text-ink/70">{course?.title ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-ink/50">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {(!signups || signups.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={3}>
                  No waitlist signups yet.
                </td>
              </tr>
            )}
          </tbody>
      </TableShell>
    </div>
  );
}
