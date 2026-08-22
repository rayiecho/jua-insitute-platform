import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readEnvVar(filePath, name) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const line = content.split('\n').find((l) => l.startsWith(name + '='));
  if (!line) throw new Error(`${name} not found in ${filePath}`);
  return line.slice(name.length + 1).trim();
}

// Uploads a rendered video to the real "lesson-videos" Supabase Storage
// bucket (created 2026-08-22) instead of committing it into apps/web's git
// repo — that approach was fine for one proof-of-concept file, not for
// dozens of lessons' worth of video bloating every deploy forever.
async function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: node scripts/upload.mjs <filename-in-out-dir>');
    process.exit(1);
  }
  const webEnvPath = path.join(ROOT, '..', 'web', '.env.local');
  const supabaseUrl = readEnvVar(webEnvPath, 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = readEnvVar(webEnvPath, 'SUPABASE_SERVICE_ROLE_KEY');

  async function uploadOne(name, contentType) {
    const filePath = path.join(ROOT, 'out', name);
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    const res = await fetch(`${supabaseUrl}/storage/v1/object/lesson-videos/${name}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buf,
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`Upload of ${name} failed:`, res.status, JSON.stringify(data));
      process.exit(1);
    }
    return `${supabaseUrl}/storage/v1/object/public/lesson-videos/${name}`;
  }

  const videoUrl = await uploadOne(filename, 'video/mp4');
  console.log('Uploaded video:', videoUrl);

  // The matching poster frame (render.mjs always renders one alongside the
  // video) uploads too, if present — LessonVideo.tsx derives its URL by
  // swapping the video's extension for .jpg, so nothing else needs wiring.
  const posterName = filename.replace(/\.(mp4|webm|mov)$/, '.jpg');
  const posterUrl = await uploadOne(posterName, 'image/jpeg');
  if (posterUrl) console.log('Uploaded poster:', posterUrl);

  console.log('\nSet the video URL above as the lesson\'s video_url in curriculum_nodes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
