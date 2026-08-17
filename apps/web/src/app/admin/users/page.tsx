import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const [{ data: users }, { data: enrollments }] = await Promise.all([
    supabase.from('platform_users').select('id, first_name, last_name, email, created_at').order('created_at', { ascending: false }),
    supabase.from('enrollments').select('user_id, course:courses(title)'),
  ]);

  const coursesByUser = new Map<string, string[]>();
  for (const e of enrollments ?? []) {
    const course = Array.isArray(e.course) ? e.course[0] : e.course;
    if (!course) continue;
    const list = coursesByUser.get(e.user_id) ?? [];
    list.push(course.title);
    coursesByUser.set(e.user_id, list);
  }

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Users</h1>
      <p className="mt-1 text-sm text-ink/60">
        Someone is a "registered user" once they enroll in a program — accounts with no enrollment yet verified an
        email but haven't started anything.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Programs</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const programs = coursesByUser.get(u.id) ?? [];
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2 text-ink">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="px-4 py-2 text-ink/70">{u.email}</td>
                  <td className="px-4 py-2">
                    {programs.length > 0 ? (
                      <span className="text-ink/70">{programs.join(', ')}</span>
                    ) : (
                      <span className="text-xs italic text-ink/40">Not enrolled</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink/50">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {(!users || users.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={4}>
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
