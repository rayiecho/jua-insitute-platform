import React from 'react';
import { Sequence, Audio, AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from './theme';
import { JuaLogo } from './JuaLogo';
import { TitleScene } from './scenes/TitleScene';
import { RoadmapScene } from './scenes/RoadmapScene';
import { SkillProgressionScene } from './scenes/SkillProgressionScene';
import { LiveSessionScene } from './scenes/LiveSessionScene';
import { PracticeScene } from './scenes/PracticeScene';
import { StatScene } from './scenes/StatScene';
import { NoInstallScene } from './scenes/NoInstallScene';
import { ClosingScene } from './scenes/ClosingScene';
import { LessonTitleScene } from './scenes/LessonTitleScene';
import { ConceptScene } from './scenes/ConceptScene';
import { CodeScene } from './scenes/CodeScene';
import { LessonClosingScene } from './scenes/LessonClosingScene';

const SCENE_COMPONENTS = {
  Title: TitleScene,
  Roadmap: RoadmapScene,
  SkillProgression: SkillProgressionScene,
  LiveSession: LiveSessionScene,
  Practice: PracticeScene,
  Stat: StatScene,
  NoInstall: NoInstallScene,
  Closing: ClosingScene,
  // Generic, data-driven types used by the automated per-lesson pipeline
  // (scripts/generate-lesson-video.mjs) — one video per real lesson, not
  // hand-built like the types above.
  LessonTitle: LessonTitleScene,
  Concept: ConceptScene,
  Code: CodeScene,
  LessonClosing: LessonClosingScene,
};

const TRANSITION_FRAMES = 15;

// Title and Closing already carry the full logo prominently — a second
// small mark there would be clutter, not branding. Every other scene gets a
// subtle, consistent corner watermark so the video reads as "ours" even if
// someone scrubs to the middle or a frame gets shared out of context.
const DARK_BACKGROUND_SCENES = new Set(['LiveSession', 'Stat']);
const WATERMARK_SCENES = new Set([
  'Roadmap', 'SkillProgression', 'LiveSession', 'Practice', 'Stat', 'NoInstall',
  'Concept', 'Code',
]);

function Watermark({ dark }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        right: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: 0.55,
      }}
    >
      <JuaLogo size={34} />
      <span
        style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: 1,
          color: dark ? 'rgba(255,255,255,0.7)' : COLORS.ink,
        }}
      >
        JUA INSTITUTE
      </span>
    </div>
  );
}

// A persistent "Tutor speaking" indicator — the equivalent of a video-call
// avatar that pulses with sound waves when your camera's off. Bars animate
// continuously (not analyzed from the real audio waveform — narration
// plays through nearly the entire video anyway, so a simple always-on
// pulse reads the same and is far simpler, as requested).
function SpeakingIndicator() {
  const frame = useCurrentFrame();
  const bars = [0, 1, 2, 3].map((i) => 7 + 11 * Math.abs(Math.sin(frame / 5 + i * 0.85)));

  return (
    <div style={{ position: 'absolute', top: 44, left: 52, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: COLORS.gold,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(200,134,43,0.35)',
        }}
      >
        <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: COLORS.ink }}>T</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 5, height: h, borderRadius: 3, backgroundColor: COLORS.gold }} />
        ))}
      </div>
    </div>
  );
}

function SceneFade({ children, durationInFrames }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, TRANSITION_FRAMES, durationInFrames - TRANSITION_FRAMES, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export const LessonVideo = ({ scenes, fraunces }) => {
  let startFrame = 0;
  const sequences = scenes.map((scene) => {
    const Component = SCENE_COMPONENTS[scene.type];
    const from = startFrame;
    startFrame += scene.durationInFrames;
    return (
      <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames}>
        <SceneFade durationInFrames={scene.durationInFrames}>
          <Component fraunces={fraunces} scene={scene} />
          {WATERMARK_SCENES.has(scene.type) && <Watermark dark={DARK_BACKGROUND_SCENES.has(scene.type)} />}
          <SpeakingIndicator />
        </SceneFade>
        <Audio src={scene.audioSrc} />
      </Sequence>
    );
  });

  return <AbsoluteFill style={{ backgroundColor: COLORS.background }}>{sequences}</AbsoluteFill>;
};
