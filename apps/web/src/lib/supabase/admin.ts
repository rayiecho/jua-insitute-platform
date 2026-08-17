import { createClient } from '@supabase/supabase-js';

// Server-only client using the service-role key — bypasses RLS by design.
// Only import this from Route Handlers / Server Actions, never from client code.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
