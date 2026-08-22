import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Classes are scheduled cohort sessions now, not "join anytime" — a learner
// can only actually join within a window around their assigned class's
// start time. This resolves what to tell them: a class ready to join right
// now, an upcoming one that's too early, or nothing scheduled at all.
const JOIN_WINDOW_BEFORE_MINUTES = 10;

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };
  if (!email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: learner } = await admin
    .from('platform_users')
    .select('id, first_name, email_verified')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (!learner) {
    return NextResponse.json({ status: 'not_found' });
  }
  if (!learner.email_verified) {
    return NextResponse.json({ status: 'not_verified' });
  }

  const { data: anyEnrollment } = await admin.from('enrollments').select('id').eq('user_id', learner.id).limit(1);
  if (!anyEnrollment || anyEnrollment.length === 0) {
    return NextResponse.json({ status: 'not_enrolled' });
  }

  const now = new Date();
  const { data: assignments } = await admin
    .from('class_session_enrollments')
    .select(
      'class_session:class_sessions(id, scheduled_start, duration_minutes, status, course:courses(title))',
    )
    .eq('user_id', learner.id);

  const upcoming = (assignments ?? [])
    .map((a) => (Array.isArray(a.class_session) ? a.class_session[0] : a.class_session))
    .filter((s): s is NonNullable<typeof s> => !!s && s.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

  for (const session of upcoming) {
    const start = new Date(session.scheduled_start);
    const joinFrom = new Date(start.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60 * 1000);
    const joinUntil = new Date(start.getTime() + session.duration_minutes * 60 * 1000);
    const course = Array.isArray(session.course) ? session.course[0] : session.course;

    if (now >= joinFrom && now <= joinUntil) {
      return NextResponse.json({
        status: 'ready',
        firstName: learner.first_name,
        classSessionId: session.id,
        courseTitle: course?.title ?? 'Program',
        scheduledStart: session.scheduled_start,
      });
    }
  }

  const next = upcoming.find((s) => new Date(s.scheduled_start) > now);
  if (next) {
    const course = Array.isArray(next.course) ? next.course[0] : next.course;
    return NextResponse.json({
      status: 'too_early',
      firstName: learner.first_name,
      courseTitle: course?.title ?? 'Program',
      scheduledStart: next.scheduled_start,
    });
  }

  return NextResponse.json({ status: 'no_class_scheduled', firstName: learner.first_name });
}
