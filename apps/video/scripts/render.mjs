import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FPS = 30;

// ffprobe ships inside @remotion/compositor-*, so real per-scene durations
// can be measured directly from the actual synthesized narration instead of
// guessed — each scene's length is exactly as long as its own audio needs,
// no more, no less.
function ffprobePath() {
  const platformPkg = fs
    .readdirSync(path.join(ROOT, 'node_modules', '@remotion'))
    .find((name) => name.startsWith('compositor-'));
  return path.join(ROOT, 'node_modules', '@remotion', platformPkg, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
}

function getDurationSeconds(mp3Path) {
  const out = execFileSync(ffprobePath(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    mp3Path,
  ]);
  return parseFloat(out.toString().trim());
}

async function main() {
  const scenesRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf-8'));

  // A small buffer of silence after each scene's narration ends, so a scene
  // doesn't hard-cut the instant the voice stops — gives the visual a beat
  // to breathe before the fade to the next scene.
  const TAIL_BUFFER_FRAMES = 20;

  const scenes = scenesRaw.map((scene) => {
    const audioPath = path.join(ROOT, 'public', 'audio', `${scene.id}.mp3`);
    const seconds = getDurationSeconds(audioPath);
    const durationInFrames = Math.ceil(seconds * FPS) + TAIL_BUFFER_FRAMES;
    console.log(`${scene.id}: ${seconds.toFixed(2)}s -> ${durationInFrames} frames`);
    // @remotion/bundler physically places public/ contents at
    // <bundle>/public/* and serves them under that same /public/ prefix
    // (confirmed by reading dist/bundle.js's getBundleStaticHash) — but
    // staticFile() called from this orchestrating Node script (outside the
    // actual bundled render context) doesn't know that and produces a
    // root-relative URL instead, which 404s. Building the URL directly
    // against the confirmed real prefix sidesteps that.
    return { ...scene, durationInFrames, audioSrc: `/public/audio/${scene.id}.mp3` };
  });

  const totalFrames = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  console.log(`Total: ${(totalFrames / FPS).toFixed(1)}s across ${scenes.length} scenes`);

  console.log('Bundling...');
  const bundleLocation = await bundle({
    entryPoint: path.join(ROOT, 'src', 'index.jsx'),
    publicDir: path.join(ROOT, 'public'),
  });

  console.log('Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'LessonVideo',
    inputProps: { scenes },
  });
  // Override the default's placeholder duration with the real total.
  composition.durationInFrames = totalFrames;

  const outDir = path.join(ROOT, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const outputLocation = path.join(outDir, process.argv[2] ?? 'welcome-to-python.mp4');

  console.log('Rendering...');
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps: { scenes },
    onProgress: ({ progress }) => {
      process.stdout.write(`\rRendering: ${Math.round(progress * 100)}%`);
    },
  });
  console.log(`\nDONE - rendered to ${outputLocation}`);

  // A branded poster frame — without this the <video> element shows a bare
  // white/black flash before playback starts (confirmed live 2026-08-22).
  // Frame 60 of the Title scene is fully settled: logo, title, and the gold
  // underline have all finished animating in.
  console.log('Rendering poster frame...');
  const posterLocation = outputLocation.replace(/\.(mp4|webm|mov)$/, '.jpg');
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    frame: 60,
    output: posterLocation,
    inputProps: { scenes },
    imageFormat: 'jpeg',
  });
  console.log(`DONE - poster rendered to ${posterLocation}`);
}

main().catch((err) => {
  console.error('RENDER FAILED:', err);
  process.exit(1);
});
