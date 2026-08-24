import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';
import { JuaLogo } from '../JuaLogo';

// Generic, data-driven version of TitleScene — reused across every lesson
// video instead of one bespoke component per video, since the automated
// pipeline generates one of these per lesson.
export function LessonTitleScene({ fraunces, scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const titleY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 14 } }), [0, 1], [30, 0]);
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lineWidth = interpolate(frame, [35, 55], [0, 280], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subOpacity = interpolate(frame, [45, 65], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.ink,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: '0 120px',
      }}
    >
      <div style={{ transform: `scale(${logoScale})` }}>
        <JuaLogo size={160} />
      </div>
      <div
        style={{
          marginTop: 40,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 100,
          color: COLORS.background,
          textAlign: 'center',
          lineHeight: 1.12,
          maxWidth: 1700,
        }}
      >
        {scene.heading}
      </div>
      <div style={{ width: lineWidth, height: 5, backgroundColor: COLORS.gold, marginTop: 34, borderRadius: 2 }} />
      {scene.subheading && (
        <div
          style={{
            marginTop: 32,
            opacity: subOpacity,
            fontFamily: 'Arial, sans-serif',
            fontSize: 36,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: 1,
            textAlign: 'center',
          }}
        >
          {scene.subheading}
        </div>
      )}
    </AbsoluteFill>
  );
}
