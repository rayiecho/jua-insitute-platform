import type { SupabaseClient, User } from '@supabase/supabase-js';

// Runs once per learner, right after their email is confirmed real — either
// via the magic-link click (AuthHashHandler → /api/auth/complete-verification)
// or, defensively, a PKCE code exchange (auth/callback). Two jobs:
//
// 1. Provision platform_users if this is the first time we've seen this
//    auth user — pulling name/education/commitment/interests from the
//    enrollment_applications row they filled in when they applied (matched
//    by email, since that row was created before any auth user existed).
//    Google sign-in has no matching application, so it falls back to the
//    name Google supplies.
// 2. Mark email_verified, and — if an application was consumed — create the
//    real `enrollments` row for the program they applied to. This is
//    deliberately NOT created at application time: the application is just
//    a staged intent until the email is proven real.
//
// Returns where the browser should land: the first lesson of the
// just-enrolled program, or the dashboard for a returning/already-enrolled
// learner.
export async function provisionAndVerify(
  admin: SupabaseClient,
  user: User,
): Promise<{ redirectTo: string; error?: string }> {
  const { data: existing } = await admin
    .from('platform_users')
    .select('id, email_verified')
    .eq('id', user.id)
    .maybeSingle();

  // platform_users.id is assumed to equal auth.users.id everywhere in this
  // app (see /api/me and friends). That assumption breaks if the auth user
  // was ever deleted and recreated for the same email (e.g. during manual
  // testing) — the old profile row survives under an id no live session
  // will ever match again, so `existing` above comes back null even though
  // a row for this email exists, and inserting a fresh one below would hit
  // the email unique constraint. Reconcile by dropping the stale row (its
  // children all cascade-delete) before proceeding — self-healing instead
  // of failing silently a second time.
  if (!existing && user.email) {
    const { data: staleByEmail } = await admin
      .from('platform_users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    if (staleByEmail) {
      await admin.from('platform_users').delete().eq('id', staleByEmail.id);
    }
  }

  const { data: application } = await admin
    .from('enrollment_applications')
    .select('id, first_name, last_name, course_id, education_level, commitment_hours, interests')
    .eq('email', user.email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const meta = user.user_metadata as { full_name?: string; name?: string };
    let firstName = application?.first_name;
    let lastName = application?.last_name;
    if (!firstName) {
      const googleName = (meta.full_name ?? meta.name ?? '').trim();
      const [first, ...rest] = googleName.split(' ');
      firstName = first || 'there';
      lastName = rest.join(' ');
    }

    const { error: insertError } = await admin.from('platform_users').insert({
      id: user.id,
      email: user.email,
      first_name: firstName || 'there',
      last_name: lastName ?? '',
      email_verified: true,
      education_level: application?.education_level ?? null,
      commitment_hours: application?.commitment_hours ?? null,
      interests: application?.interests ?? null,
    });
    if (insertError) return { redirectTo: '/dashboard', error: insertError.message };
  } else if (!existing.email_verified) {
    const { error: updateError } = await admin
      .from('platform_users')
      .update({ email_verified: true })
      .eq('id', user.id);
    if (updateError) return { redirectTo: '/dashboard', error: updateError.message };
  }

  let redirectTo = '/dashboard';

  if (application) {
    await admin.from('enrollment_applications').update({ status: 'verified' }).eq('id', application.id);

    const { data: enrollment } = await admin
      .from('enrollments')
      .upsert({ user_id: user.id, course_id: application.course_id }, { onConflict: 'user_id,course_id' })
      .select('id')
      .single();

    if (enrollment) {
      const { data: firstNode } = await admin
        .from('curriculum_nodes')
        .select('slug')
        .eq('course_id', application.course_id)
        .order('sequence_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstNode) redirectTo = `/learn/${firstNode.slug}`;
    }
  }

  return { redirectTo };
}
