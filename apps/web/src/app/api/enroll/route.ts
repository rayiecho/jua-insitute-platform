import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Called two places: when a learner clicks "Start the program" (courseId
// only) and on every lesson page view (courseId + nodeId, updates the
// "where they are" pointer). Upserts so the second call after the first
// doesn't clobber enrolled_at, and repeat lesson views just update
// last_viewed_at. userId comes from the real auth session, not the request
// body — a client-supplied userId would let anyone enroll as, or overwrite
// the "current lesson" pointer for, any other learner.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  const { courseId, nodeId } = await request.json();
  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
  }
  const userId = user.id;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();

  if (existing) {
    const update: Record<string, unknown> = {};
    if (nodeId) {
      update.last_viewed_node_id = nodeId;
      update.last_viewed_at = new Date().toISOString();
    }
    if (Object.keys(update).length > 0) {
      await admin.from('enrollments').update(update).eq('id', existing.id);
    }
    return NextResponse.json({ id: existing.id });
  }

  const { data: created, error } = await admin
    .from('enrollments')
    .insert({
      user_id: userId,
      course_id: courseId,
      last_viewed_node_id: nodeId ?? null,
      last_viewed_at: nodeId ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? 'failed to enroll' }, { status: 500 });
  }

  return NextResponse.json({ id: created.id });
}
