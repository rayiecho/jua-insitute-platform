import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getEnvVar } from './env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function ffmpegPath() {
  const platformPkg = fs
    .readdirSync(path.join(ROOT, 'node_modules', '@remotion'))
    .find((name) => name.startsWith('compositor-'));
  return path.join(ROOT, 'node_modules', '@remotion', platformPkg, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
}

// Raw Deepgram Aura output measured at -25.6 LUFS — well below the ~-14
// LUFS video/streaming loudness standard (confirmed live, 2026-08-24,
// hence the "volume too low" note). Normalizing every clip to -14 LUFS
// here instead of trying to fix it in Remotion, since ffmpeg's loudnorm
// does real integrated-loudness measurement instead of a blind gain
// multiply that could clip.
function normalizeLoudness(filePath) {
  const tmpPath = filePath + '.norm.mp3';
  execFileSync(ffmpegPath(), [
    '-y', '-i', filePath,
    '-af', 'loudnorm=I=-11:TP=-0.3:LRA=11',
    '-ar', '44100',
    tmpPath,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  fs.renameSync(tmpPath, filePath);
}

// Same voice as the live voice tutor (apps/agent/src/index.ts uses
// aura-2-orpheus-en) — brand consistency between the live tutor's voice and
// these narrated lesson videos.
const DEEPGRAM_KEY = getEnvVar('DEEPGRAM_API_KEY', path.join(ROOT, '..', 'agent', '.env.local'));
const VOICE_MODEL = 'aura-2-orpheus-en';

// This network has confirmed, documented flakiness specifically on
// Deepgram's endpoints (unrelated to LiveKit or generic HTTPS, verified
// during earlier live-tutoring debugging) — retry transient socket drops
// rather than failing the whole lesson over a single dropped connection.
async function synthesize(text, outPath, attempt = 1) {
  try {
    const res = await fetch(`https://api.deepgram.com/v1/speak?model=${VOICE_MODEL}&encoding=mp3`, {
      method: 'POST',
      headers: { Authorization: `Token ${DEEPGRAM_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Deepgram TTS failed (${res.status}): ${await res.text()}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    normalizeLoudness(outPath);
    return fs.statSync(outPath).size;
  } catch (err) {
    if (attempt >= 4) throw err;
    const delayMs = attempt * 2000;
    console.warn(`  (retry ${attempt}/3 after ${delayMs}ms — ${err.message || err})`);
    await new Promise((r) => setTimeout(r, delayMs));
    return synthesize(text, outPath, attempt + 1);
  }
}

async function main() {
  const scenesPath = process.argv[2] ?? path.join(ROOT, 'scenes.json');
  const scenes = JSON.parse(fs.readFileSync(scenesPath, 'utf-8'));
  const audioDir = path.join(ROOT, 'public', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  for (const scene of scenes) {
    const outPath = path.join(audioDir, `${scene.id}.mp3`);
    const bytes = await synthesize(scene.narration, outPath);
    console.log(`${scene.id}: ${bytes} bytes -> ${outPath}`);
  }
  console.log('All narration audio synthesized.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
