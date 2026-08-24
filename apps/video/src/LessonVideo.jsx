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
        </SceneFade>
        <Audio src={scene.audioSrc} />
      </Sequence>
    );
  });

  return <AbsoluteFill style={{ backgroundColor: COLORS.background }}>{sequences}</AbsoluteFill>;
};
