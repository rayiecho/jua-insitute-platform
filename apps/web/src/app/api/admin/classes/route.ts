import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAgentMinutesBudget } from '@/lib/livekitBudget';

const CAT_OFFSET_HOURS = 2; // matches /admin/classes and /admin/analytics

function catInputToUtcIso(value: string): string {
  const [datePart, timePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh - CAT_OFFSET_HOURS, mm);
  return new Date(utcMs).toISOString();
}

// Plain HTML form POST (see /admin/classes) — no client JS needed for the
// admin scheduling flow. Redirects back to the list on success.
export async function POST(request: Request) {
  const formData = await request.formData();
  const courseId = formData.get('courseId')?.toString();
  const weekNumberRaw = formData.get('weekNumber')?.toString();
  const scheduledStartRaw = formData.get('scheduledStart')?.toString();
  const durationMinutesRaw = formData.get('durationMinutes')?.toString();

  if (!courseId || !scheduledStartRaw) {
    return NextResponse.json({ error: 'courseId and scheduledStart are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const durationMinutes = durationMinutesRaw ? Number(durationMinutesRaw) : 45;

  // Hard-stop before creating a class that would push this calendar month's
  // agent-minutes past the safety threshold — LiveKit's free Build tier
  // fails new agent sessions outright once its real quota is hit, with no
  // graceful degrade, so this has to block scheduling, not just warn.
  const budgetCheck = await checkAgentMinutesBudget(admin, durationMinutes);
  if (!budgetCheck.allowed) {
    const pct = Math.round(budgetCheck.usage.agentMinutesPct * 100);
    return NextResponse.redirect(
      new URL(
        `/admin/classes?error=${encodeURIComponent(
          `Scheduling this class would risk exceeding LiveKit's free monthly quota (currently at ${pct}% of the hard cap). Wait for next month's reset, or upgrade the LiveKit plan.`,
        )}`,
        request.url,
      ),
      { status: 303 },
    );
  }

  let weekId: string | null = null;
  if (weekNumberRaw) {
    const { data: week } = await admin
      .from('course_weeks')
      .select('id')
      .eq('course_id', courseId)
      .eq('week_number', Number(weekNumberRaw))
      .maybeSingle();
    weekId = week?.id ?? null;
  }

  await admin.from('class_sessions').insert({
    course_id: courseId,
    week_id: weekId,
    scheduled_start: catInputToUtcIso(scheduledStartRaw),
    duration_minutes: durationMinutes,
  });

  return NextResponse.redirect(new URL('/admin/classes', request.url), { status: 303 });
}
