import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Lightweight pre-check for the live-class lobby — resolves a typed email
// to verified/enrolled status WITHOUT minting a token, creating a room, or
// dispatching the agent. Deliberately session-independent: live classes
// don't use the browser session at all (see /api/livekit-token), so this is
// the only gate standing between a stranger and a room.
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

  // Full list, not just an existence check — a learner enrolled in more than
  // one program needs to pick which one this class is for (see TutorLobby),
  // rather than the tutor silently guessing from whichever they touched most
  // recently.
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id, course:courses(title)')
    .eq('user_id', learner.id);

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ status: 'not_enrolled' });
  }

  const programs = enrollments.map((e) => {
    const course = Array.isArray(e.course) ? e.course[0] : e.course;
    return { courseId: e.course_id, title: course?.title ?? 'Program' };
  });

  return NextResponse.json({ status: 'ready', firstName: learner.first_name, programs });
}
