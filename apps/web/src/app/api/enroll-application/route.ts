import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// The real "I'm enrolling" moment — filled in before any auth exists, so
// this deliberately doesn't touch platform_users or enrollments yet (see
// lib/auth/provision.ts for why). Just stages the application so admin sees
// it immediately, then the caller sends the verification email itself
// (needs the anon client's signInWithOtp, not available server-side without
// re-deriving it — kept in EnrollmentForm right after this call succeeds).
export async function POST(request: Request) {
  const body = await request.json();
  const { firstName, lastName, email, courseId, educationLevel, commitmentHours, interests, policyAccepted } = body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    courseId?: string;
    educationLevel?: string;
    commitmentHours?: string;
    interests?: string;
    policyAccepted?: boolean;
  };

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !courseId) {
    return NextResponse.json({ error: 'firstName, lastName, email, and courseId are required' }, { status: 400 });
  }
  if (!educationLevel || !commitmentHours) {
    return NextResponse.json({ error: 'educationLevel and commitmentHours are required' }, { status: 400 });
  }
  if (!policyAccepted) {
    return NextResponse.json({ error: 'You must accept the policies to enroll' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('enrollment_applications').insert({
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    email: email.trim().toLowerCase(),
    course_id: courseId,
    education_level: educationLevel,
    commitment_hours: commitmentHours,
    interests: interests?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
