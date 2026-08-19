import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Real page-view logging, nothing more — no third-party analytics vendor,
// no fingerprinting. visitor_id is a random cookie-based id the client
// generates itself (see PageTracker.tsx), not tied to any real identity, so
// this can accept writes with no auth check the same way a public counter
// would.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { visitorId, path, referrer } = (body ?? {}) as { visitorId?: string; path?: string; referrer?: string };

  if (!visitorId || !path) {
    return NextResponse.json({ error: 'visitorId and path are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from('page_views').insert({
    visitor_id: visitorId,
    path: path.slice(0, 500),
    referrer: referrer ? referrer.slice(0, 500) : null,
  });

  return NextResponse.json({ ok: true });
}
