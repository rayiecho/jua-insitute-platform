import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// No auth yet (MVP scope, Section 1) — this is a stand-in "log in" that just
// gets-or-creates a platform_users row by email so the rest of the app has a
// stable UUID to key continuity/state-injection data on, instead of an
// arbitrary display name. Replace with real auth before this goes further
// than local dev/demo use.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const firstName = body?.firstName?.trim();
  const lastName = body?.lastName?.trim();
  const email = body?.email?.trim().toLowerCase();

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'firstName, lastName, and email are required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('platform_users')
    .select('id, first_name, last_name, email')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(existing);
  }

  const { data: created, error } = await supabase
    .from('platform_users')
    .insert({ first_name: firstName, last_name: lastName, email })
    .select('id, first_name, last_name, email')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(created);
}
