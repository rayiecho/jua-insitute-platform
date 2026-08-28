import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateScenesForLesson } from './generate-script.mjs';
import { uploadVideoAndPoster } from './upload.mjs';
import { getEnvVar } from './env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const webEnv = path.join(ROOT, '..', 'web', '.env.local');

// spawn (not execFileSync) so this doesn't block Node's event loop — the
// deployed video-worker service needs to keep answering other requests
// (job-status polling, health checks) while a render is in progress.
// Confirmed live (2026-08-25): execFileSync froze the entire server for
// the whole render duration.
// Confirmed live (2026-08-27): Remotion's own browser-crash recovery
// ("Killed previous browser and making new one") can itself hang forever
// with no further output and no child process left running — the render
// silently stalls rather than failing, which the existing retry logic
// never sees since no error is ever thrown. A wall-clock timeout forces a
// stuck child to actually fail so processLesson's retry loop can recover.
const CHILD_TIMEOUT_MS = 15 * 60 * 1000;

function runScript(scriptPath, args, log) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], { cwd: ROOT });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${scriptPath} timed out after ${CHILD_TIMEOUT_MS / 1000}s (no progress — likely a hung browser recovery)`));
    }, CHILD_TIMEOUT_MS);
    child.stdout.on('data', (d) => log(d.toString().trimEnd()));
    child.stderr.on('data', (d) => log(d.toString().trimEnd()));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
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

// Exported so the Railway HTTP service (server.mjs) can call this directly
// instead of re-invoking the CLI as a subprocess.
export async function processLesson(slug, log = console.log) {
  log(`\n=== ${slug} ===`);

  log('Generating narration script (Groq, real code extracted from the lesson)...');
  const { lesson, scenes } = await generateScenesForLesson(slug);
  fs.writeFileSync(path.join(ROOT, 'scenes.json'), JSON.stringify(scenes, null, 2));
  log(`  ${scenes.length} scenes`);

  // Clear stale audio from whatever lesson ran before this one.
  const audioDir = path.join(ROOT, 'public', 'audio');
  fs.rmSync(audioDir, { recursive: true, force: true });
  fs.mkdirSync(audioDir, { recursive: true });

  log('Synthesizing narration audio (Deepgram, aura-2-orpheus-en)...');
  await runScript('scripts/synthesize.mjs', ['scenes.json'], log);

  log('Rendering video...');
  const outputName = `${slug}.mp4`;
  // Remotion's bundler snapshots public/ into a temp dir at bundle time;
  // a freshly-written mp3 has occasionally 404'd there (confirmed live,
  // 2026-08-26) even though it exists on disk — a transient Windows
  // file-availability race, not a real content problem. Retry the render
  // itself rather than losing an otherwise-good narration/audio pass.
  let renderErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await runScript('scripts/render.mjs', [outputName], log);
      renderErr = null;
      break;
    } catch (err) {
      renderErr = err;
      log(`  (render attempt ${attempt}/3 failed: ${err.message})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (renderErr) throw renderErr;

  log('Uploading to Supabase Storage...');
  const { videoUrl, posterUrl } = await uploadVideoAndPoster(outputName);
  log(`  video: ${videoUrl}`);
  log(`  poster: ${posterUrl}`);

  log('Updating curriculum_nodes.video_url...');
  await setVideoUrl(lesson.id, videoUrl);
  log(`Done: ${lesson.title}`);

  return { lesson, videoUrl, posterUrl };
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
