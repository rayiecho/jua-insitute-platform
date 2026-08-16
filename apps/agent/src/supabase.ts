import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the agent worker.');
}

// Service-role client: the agent worker is a trusted backend process, not an
// end-user client, so it bypasses RLS by design (see packages/supabase/README.md).
export const supabase = createClient(url, serviceRoleKey);

export async function logConnectionEvent(
  sessionRoomName: string,
  eventType: 'connected' | 'dropped' | 'reconnected' | 'heartbeat',
) {
  const { data: session } = await supabase
    .from('classroom_sessions')
    .select('id')
    .eq('room_name', sessionRoomName)
    .maybeSingle();

  if (!session) return; // room not yet linked to a session row — nothing to log against

  await supabase.from('session_connection_events').insert({
    session_id: session.id,
    event_type: eventType,
  });
}
