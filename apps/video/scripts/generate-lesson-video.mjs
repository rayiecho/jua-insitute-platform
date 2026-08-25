import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateScenesForLesson } from './generate-script.mjs';
import { uploadVideoAndPoster } from './upload.mjs';
import { getEnvVar } from './env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const webEnv = path.join(ROOT, '..', 'web', '.env.local');

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
  execFileSync('node', ['scripts/synthesize.mjs', 'scenes.json'], { cwd: ROOT, stdio: 'inherit' });

  log('Rendering video...');
  const outputName = `${slug}.mp4`;
  execFileSync('node', ['scripts/render.mjs', outputName], { cwd: ROOT, stdio: 'inherit' });

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
  for (const slug of slugs) {
    await processLesson(slug);
  }
  console.log(`\nAll ${slugs.length} lesson video(s) complete.`);
}

if (process.argv[1] && path.basename(process.argv[1]) === 'generate-lesson-video.mjs') {
  main().catch((err) => {
    console.error('\nFAILED:', err);
    process.exit(1);
  });
}
