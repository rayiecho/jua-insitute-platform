import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMonthlyLiveKitUsage } from '@/lib/livekitBudget';

const CAT_OFFSET_HOURS = 2; // Central Africa Time, UTC+2, no DST — matches /admin/analytics

function formatCat(iso: string): string {
  const d = new Date(new Date(iso).getTime() + CAT_OFFSET_HOURS * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' CAT';
}

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const admin = createAdminClient();
  const usage = await getMonthlyLiveKitUsage(admin);

  const [{ data: courses }, { data: sessions }] = await Promise.all([
    admin.from('courses').select('id, title').eq('status', 'live').order('title'),
    admin
      .from('class_sessions')
      .select('id, scheduled_start, duration_minutes, status, course:courses(title), week:course_weeks(week_number, title)')
      .order('scheduled_start', { ascending: false })
      .limit(50),
  ]);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: enrollmentCounts } =
    sessionIds.length > 0
      ? await admin.from('class_session_enrollments').select('class_session_id').in('class_session_id', sessionIds)
      : { data: [] as { class_session_id: string }[] };
  const countByClass = new Map<string, number>();
  for (const row of enrollmentCounts ?? []) {
    countByClass.set(row.class_session_id, (countByClass.get(row.class_session_id) ?? 0) + 1);
  }

  return (
    <div className="w-full max-w-4xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Scheduled live classes</h1>
      <p className="mt-1 text-sm text-ink/60">
        Cohort classes — multiple learners join the same room at a fixed time. Times below are CAT (UTC+2).
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
          LiveKit free-tier usage this month (budgeted to 75% of the real cap — this platform blocks new scheduling past that)
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UsageBar label="Agent minutes" used={usage.agentMinutesUsed} cap={1000} />
          <UsageBar label="WebRTC minutes" used={usage.webrtcMinutesUsed} cap={5000} />
        </div>
      </div>

      <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Schedule a new class</h2>
      <form action="/api/admin/classes" method="post" className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Program</label>
          <select name="courseId" required className="rounded border border-border bg-card px-3 py-2 text-sm text-ink">
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Week number (optional)</label>
          <input
            type="number"
            name="weekNumber"
            min={1}
            max={7}
            className="w-20 rounded border border-border bg-card px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Start (CAT)</label>
          <input
            type="datetime-local"
            name="scheduledStart"
            required
            className="rounded border border-border bg-card px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Duration (min)</label>
          <input
            type="number"
            name="durationMinutes"
            defaultValue={45}
            min={15}
            max={120}
            className="w-24 rounded border border-border bg-card px-3 py-2 text-sm text-ink"
          />
        </div>
        <button type="submit" className="rounded bg-gold px-4 py-2 text-sm font-semibold text-ink">
          Schedule
        </button>
      </form>

      <h2 className="mt-10 font-serif text-lg font-semibold text-ink">Upcoming & recent classes</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left">
            <tr>
              <th className="px-4 py-2">When (CAT)</th>
              <th className="px-4 py-2">Program</th>
              <th className="px-4 py-2">Week</th>
              <th className="px-4 py-2">Learners</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(sessions ?? []).map((s) => {
              const course = Array.isArray(s.course) ? s.course[0] : s.course;
              const week = Array.isArray(s.week) ? s.week[0] : s.week;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 text-ink">{formatCat(s.scheduled_start)}</td>
                  <td className="px-4 py-2 text-ink/70">{course?.title ?? '—'}</td>
                  <td className="px-4 py-2 text-ink/70">{week ? `Week ${week.week_number}` : '—'}</td>
                  <td className="px-4 py-2 text-ink/70">{countByClass.get(s.id) ?? 0}</td>
                  <td className="px-4 py-2 text-ink/70">{s.status}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/classes/${s.id}`} className="text-xs font-medium text-tan hover:text-ink">
                      Manage →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!sessions || sessions.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={6}>
                  No classes scheduled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsageBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const realPct = Math.min(100, Math.round((used / cap) * 100));
  const overSafety = used / cap > 0.75;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink/60">
        <span>{label}</span>
        <span className={overSafety ? 'font-semibold text-red-600' : ''}>
          {used.toLocaleString()} / {cap.toLocaleString()} ({realPct}%)
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${overSafety ? 'bg-red-500' : 'bg-gold'}`}
          style={{ width: `${realPct}%` }}
        />
        {/* Marks the real 75% safety line we budget to, distinct from the 100% hard cap the bar itself represents. */}
        <div className="relative -mt-2 h-2 w-full">
          <div className="absolute top-0 h-2 border-l-2 border-dashed border-ink/30" style={{ left: '75%' }} />
        </div>
      </div>
    </div>
  );
}
