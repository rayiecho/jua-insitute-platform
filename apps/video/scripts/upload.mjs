import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnvVar } from './env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const webEnvPath = path.join(ROOT, '..', 'web', '.env.local');

// Uploads a rendered video to the real "lesson-videos" Supabase Storage
// bucket (created 2026-08-22) instead of committing it into apps/web's git
// repo — that approach was fine for one proof-of-concept file, not for
// dozens of lessons' worth of video bloating every deploy forever.
export async function uploadOne(name, contentType) {
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', webEnvPath);
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', webEnvPath);
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
    throw new Error(`Upload of ${name} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/lesson-videos/${name}`;
}

export async function uploadVideoAndPoster(filename) {
  const videoUrl = await uploadOne(filename, 'video/mp4');
  const posterName = filename.replace(/\.(mp4|webm|mov)$/, '.jpg');
  const posterUrl = await uploadOne(posterName, 'image/jpeg');
  return { videoUrl, posterUrl };
}

// CLI usage: node scripts/upload.mjs <filename-in-out-dir>
if (process.argv[1] && path.basename(process.argv[1]) === 'upload.mjs') {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: node scripts/upload.mjs <filename-in-out-dir>');
    process.exit(1);
  }
  const { videoUrl, posterUrl } = await uploadVideoAndPoster(filename);
  console.log('Uploaded video:', videoUrl);
  if (posterUrl) console.log('Uploaded poster:', posterUrl);
  console.log('\nSet the video URL above as the lesson\'s video_url in curriculum_nodes.');
}
