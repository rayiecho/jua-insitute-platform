import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnvVar } from './env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const webEnv = path.join(ROOT, '..', 'web', '.env.local');
const agentEnv = path.join(ROOT, '..', 'agent', '.env.local');

const AFRIVID_ENDPOINT = 'https://afrivid-processor-222827815864.africa-south1.run.app/api/v1/generate-video';
// Polling, not local rendering — AfriVid's own Cloud Run infra does the
// actual work now. A real ~3 minute lesson video takes a few minutes; give
// it a generous ceiling before giving up rather than guessing too low.
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

async function fetchLesson(slug) {
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', webEnv);
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', webEnv);
  const res = await fetch(
    `${supabaseUrl}/rest/v1/curriculum_nodes?select=id,title,slug,markdown_content&slug=eq.${slug}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const rows = await res.json();
  if (!res.ok || !Array.isArray(rows)) throw new Error(`Lesson fetch failed: ${JSON.stringify(rows)}`);
  if (rows.length === 0) throw new Error(`No lesson found with slug "${slug}"`);
  return rows[0];
}

async function setVideoUrl(nodeId, videoUrl) {
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', webEnv);
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', webEnv);
  const res = await fetch(`${supabaseUrl}/rest/v1/curriculum_nodes?id=eq.${nodeId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ video_url: videoUrl }),
  });
  if (!res.ok) throw new Error(`Setting video_url failed: ${res.status} ${await res.text()}`);
}

async function pollUntilDone(statusUrl, log) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(statusUrl);
    if (!res.ok) throw new Error(`Status check failed: ${res.status} ${await res.text()}`);
    const job = await res.json();
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(`AfriVid render failed: ${job.stage ?? 'unknown reason'}`);
    log(`  ${job.progress ?? 0}% — ${job.stage ?? job.status}`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for AfriVid render after ${POLL_TIMEOUT_MS / 1000}s`);
}

// Exported so the Railway HTTP service (server.mjs) can call this directly
// instead of re-invoking the CLI as a subprocess.
export async function processLesson(slug, log = console.log) {
  log(`\n=== ${slug} ===`);
  const lesson = await fetchLesson(slug);

  log('Requesting video from AfriVid Studio (verbatim script mode — no AI rewriting)...');
  const apiKey = getEnvVar('AFRIVID_API_KEY', agentEnv);
  const submitRes = await fetch(AFRIVID_ENDPOINT, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: lesson.title,
      script: lesson.markdown_content,
      language: 'English',
      voice: 'woman',
      style: 'educational and informative',
    }),
  });
  const submitBody = await submitRes.json();
  if (!submitRes.ok || !submitBody.accepted) {
    throw new Error(`AfriVid request rejected: ${submitRes.status} ${JSON.stringify(submitBody)}`);
  }
  log(`  job ${submitBody.job_id} — ~${submitBody.estimated_duration}s across ${submitBody.scene_count} scenes`);

  log('Waiting for render...');
  const finished = await pollUntilDone(submitBody.status_url, log);

  log('Updating curriculum_nodes.video_url...');
  await setVideoUrl(lesson.id, finished.output_url);
  log(`Done: ${lesson.title}`);

  return { lesson, videoUrl: finished.output_url, posterUrl: finished.thumbnail_url };
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('Usage: node scripts/generate-lesson-video.mjs <slug> [<slug> ...]');
    process.exit(1);
  }
  const failed = [];
  for (const slug of slugs) {
    try {
      await processLesson(slug);
    } catch (err) {
      console.error(`\nFAILED (${slug}):`, err);
      failed.push(slug);
    }
  }
  console.log(`\n${slugs.length - failed.length}/${slugs.length} lesson video(s) complete.`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === 'generate-lesson-video.mjs') {
  main().catch((err) => {
    console.error('\nFAILED:', err);
    process.exit(1);
  });
}
