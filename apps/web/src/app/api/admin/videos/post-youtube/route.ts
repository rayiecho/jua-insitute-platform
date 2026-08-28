import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'r.ayiecho@alustudent.com';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await request.json().catch(() => ({}));
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const workerUrl = process.env.VIDEO_WORKER_URL;
  const workerSecret = process.env.VIDEO_WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    return NextResponse.json({ error: 'Video worker is not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${workerUrl}/post-youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerSecret}` },
      body: JSON.stringify({ slug }),
    });
    // The worker doesn't always answer with JSON (a cold start or a
    // Railway edge error returns an HTML error page) — parsing that
    // unconditionally threw here and produced Next's own generic HTML 500,
    // which the client then also failed to parse silently. Guard both ends.
    const data = await res.json().catch(() => null);
    if (!data) {
      return NextResponse.json({ error: `Video worker returned a non-JSON response (${res.status})` }, { status: 502 });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: `Could not reach video worker: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }
}
