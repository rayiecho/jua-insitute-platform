import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from 'dotenv';

// Imported first (side-effect only) by index.ts so LIVEKIT_*/SUPABASE_*/etc. are
// populated in process.env before any other module reads them at import time.
// Resolved relative to this file, not process.cwd(), so it works the same
// whether invoked directly or via an npm workspace script from the repo root.
const agentDir = dirname(fileURLToPath(import.meta.url));
config({ path: join(agentDir, '..', '.env.local') });
config({ path: join(agentDir, '..', '.env') });
