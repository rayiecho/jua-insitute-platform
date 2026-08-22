import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Supabase's free tier pauses a project after ~1 week with no activity —
// confirmed real risk (2026-08-22 infra planning): if that happens, sign-in,
// the dashboard, everything using the DB just stops working for whoever
// tries next. Triggered on a schedule by Vercel Cron (see vercel.json) —
// a trivial real query is enough to count as activity and keep the project
// alive, at zero cost, with no new vendor.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('platform_users').select('id').limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
