import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminOverviewPage() {
  const supabase = createAdminClient();

  const [users, enrollments, waitlist, submissions, courses] = await Promise.all([
    supabase.from('platform_users').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }),
    supabase.from('waitlist_signups').select('id', { count: 'exact', head: true }),
    supabase.from('student_assignments_progress').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id, title, status'),
  ]);

  // "Registered" per the actual definition in use here: someone who enrolled
  // in a program, not just anyone who ever verified an email. Count()
  // doesn't dedupe, and a learner can have multiple enrollments, so this is
  // computed from distinct user_ids rather than a row count.
  const { data: enrolledUserRows } = await supabase.from('enrollments').select('user_id');
  const registeredCount = new Set((enrolledUserRows ?? []).map((r) => r.user_id)).size;

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Overview</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Registered users" value={registeredCount ?? 0} href="/admin/users" />
        <Stat label="Enrollments" value={enrollments.count ?? 0} href="/admin/enrollments" />
        <Stat label="Waitlist signups" value={waitlist.count ?? 0} href="/admin/waitlist" />
        <Stat label="Submissions" value={submissions.count ?? 0} href="/admin/submissions" />
      </div>

      <div className="mt-10">
        <h2 className="font-serif text-lg font-semibold text-ink">Programs</h2>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {(courses.data ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between px-5 py-3">
              <span className="font-medium text-ink">{c.title}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">{c.status}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-xs text-ink/40">
        Total accounts (may include unenrolled sign-ins): {users.count ?? 0}
      </p>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-card p-4 hover:border-gold">
      <p className="text-xs uppercase tracking-wide text-ink/60">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-ink">{value}</p>
    </Link>
  );
}
