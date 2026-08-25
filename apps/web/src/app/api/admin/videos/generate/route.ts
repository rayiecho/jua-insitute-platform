import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'r.ayiecho@alustudent.com';

// Proxies to the video-worker service on Railway (apps/video/server.mjs) —
// real rendering (headless Chromium + ffmpeg, multi-minute CPU work) can't
// run on Cloudflare Workers, so this just kicks off a job there and hands
// back its ID for the admin UI to poll. Auth-gated here (unlike some
// existing /api/admin routes) since this triggers real Groq/Deepgram spend
// per call, not just a DB write.
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

  const res = await fetch(`${workerUrl}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerSecret}` },
    body: JSON.stringify({ slug }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
