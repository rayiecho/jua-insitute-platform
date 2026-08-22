import React from 'react';
import { Composition } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Fraunces';
import scenes from '../scenes.json';
import { LessonVideo } from './LessonVideo';

const { fontFamily: fraunces } = loadFont('normal', { weights: ['600', '700'], subsets: ['latin'] });

const FPS = 30;

// Real per-scene durations come from the actual synthesized narration audio
// (measured via ffprobe in scripts/render.mjs) and are injected as a prop at
// render time — this file only needs a reasonable default so the Studio
// preview (if ever opened) doesn't crash before that data exists.
const DEFAULT_DURATION_FRAMES = scenes.length * FPS * 6;

export const RemotionRoot = () => {
  return (
    <Composition
      id="LessonVideo"
      component={LessonVideo}
      durationInFrames={DEFAULT_DURATION_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{
        scenes: scenes.map((s) => ({ ...s, durationInFrames: FPS * 6, audioSrc: `/public/audio/${s.id}.mp3` })),
        fraunces,
      }}
    />
  );
};
