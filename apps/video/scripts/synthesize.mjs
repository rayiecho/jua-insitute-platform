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

// Same voice as the live voice tutor (apps/agent/src/index.ts uses
// aura-2-orpheus-en) — brand consistency between the live tutor's voice and
// these narrated lesson videos.
const DEEPGRAM_KEY = readEnvVar(path.join(ROOT, '..', 'agent', '.env.local'), 'DEEPGRAM_API_KEY');
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
    return buf.length;
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
