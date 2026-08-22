import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkWebrtcMinutesBudget } from '@/lib/livekitBudget';

// Plain HTML form POST from /admin/classes/[id] — adds the checked learners
// to this scheduled class session.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const userIds = formData.getAll('userIds').map((v) => v.toString());

  if (userIds.length > 0) {
    const admin = createAdminClient();

    const { data: session } = await admin
      .from('class_sessions')
      .select('duration_minutes')
      .eq('id', id)
      .maybeSingle();

    // WebRTC-minutes is the one that runs out fastest (it scales with real
    // headcount, unlike agent-minutes) — this is the actual moment we learn
    // the real incremental headcount, so it's checked here, not at class
    // creation time when enrollment isn't known yet.
    const budgetCheck = await checkWebrtcMinutesBudget(admin, session?.duration_minutes ?? 45, userIds.length);
    if (!budgetCheck.allowed) {
      const pct = Math.round(budgetCheck.usage.webrtcMinutesPct * 100);
      return NextResponse.redirect(
        new URL(
          `/admin/classes/${id}?error=${encodeURIComponent(
            `Adding these ${userIds.length} learners would risk exceeding LiveKit's free monthly quota (currently at ${pct}% of the hard cap). Add fewer learners, wait for next month's reset, or upgrade the LiveKit plan.`,
          )}`,
          request.url,
        ),
        { status: 303 },
      );
    }

    await admin.from('class_session_enrollments').insert(
      userIds.map((userId) => ({ class_session_id: id, user_id: userId })),
    );
  }

  return NextResponse.redirect(new URL(`/admin/classes/${id}`, request.url), { status: 303 });
}
