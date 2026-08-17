import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminWaitlistPage() {
  const supabase = createAdminClient();

  const { data: signups } = await supabase
    .from('waitlist_signups')
    .select('id, email, created_at, course:courses(title)')
    .order('created_at', { ascending: false });

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Waitlist</h1>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
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
        </table>
      </div>
    </div>
  );
}
