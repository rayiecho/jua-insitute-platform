import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateScenesForLesson } from './generate-script.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readEnvVar(filePath, name) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const line = content.split('\n').find((l) => l.startsWith(name + '='));
  if (!line) throw new Error(`${name} not found in ${filePath}`);
  return line.slice(name.length + 1).trim();
}

const webEnv = path.join(ROOT, '..', 'web', '.env.local');
const SUPABASE_URL = readEnvVar(webEnv, 'NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = readEnvVar(webEnv, 'SUPABASE_SERVICE_ROLE_KEY');

async function uploadFile(name, contentType) {
  const filePath = path.join(ROOT, 'out', name);
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/lesson-videos/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buf,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload of ${name} failed: ${res.status} ${JSON.stringify(data)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/lesson-videos/${name}`;
}

async function setVideoUrl(nodeId, videoUrl) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/curriculum_nodes?id=eq.${nodeId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ video_url: videoUrl }),
  });
  if (!res.ok) throw new Error(`Setting video_url failed: ${res.status} ${await res.text()}`);
}

async function processLesson(slug) {
  console.log(`\n=== ${slug} ===`);

  console.log('Generating narration script (Groq, real code extracted from the lesson)...');
  const { lesson, scenes } = await generateScenesForLesson(slug);
  fs.writeFileSync(path.join(ROOT, 'scenes.json'), JSON.stringify(scenes, null, 2));
  console.log(`  ${scenes.length} scenes`);

  // Clear stale audio from whatever lesson ran before this one.
  const audioDir = path.join(ROOT, 'public', 'audio');
  fs.rmSync(audioDir, { recursive: true, force: true });
  fs.mkdirSync(audioDir, { recursive: true });

  console.log('Synthesizing narration audio (Deepgram, aura-2-orpheus-en)...');
  execFileSync('node', ['scripts/synthesize.mjs', 'scenes.json'], { cwd: ROOT, stdio: 'inherit' });

  console.log('Rendering video...');
  const outputName = `${slug}.mp4`;
  execFileSync('node', ['scripts/render.mjs', outputName], { cwd: ROOT, stdio: 'inherit' });

  console.log('Uploading to Supabase Storage...');
  const videoUrl = await uploadFile(outputName, 'video/mp4');
  const posterUrl = await uploadFile(outputName.replace(/\.mp4$/, '.jpg'), 'image/jpeg');
  console.log(`  video: ${videoUrl}`);
  console.log(`  poster: ${posterUrl}`);

  console.log('Updating curriculum_nodes.video_url...');
  await setVideoUrl(lesson.id, videoUrl);
  console.log(`Done: ${lesson.title}`);
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

main().catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
