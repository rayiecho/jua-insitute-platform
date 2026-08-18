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

  const { data: enrollment } = await admin.from('enrollments').select('id').eq('user_id', learner.id).limit(1);
  if (!enrollment || enrollment.length === 0) {
    return NextResponse.json({ status: 'not_enrolled' });
  }

  return NextResponse.json({ status: 'ready', firstName: learner.first_name });
}
