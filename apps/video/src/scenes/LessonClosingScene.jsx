import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';
import { JuaLogo } from '../JuaLogo';

// Generic, data-driven closer — every lesson video ends on this, with its
// own short line rather than the fixed "Let's start." used by the program
// overview video.
export function LessonClosingScene({ fraunces, scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const textOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lineWidth = interpolate(frame, [45, 65], [0, 220], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.ink,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: '0 140px',
      }}
    >
      <div style={{ transform: `scale(${logoScale})` }}>
        <JuaLogo size={130} />
      </div>
      <div
        style={{
          marginTop: 44,
          opacity: textOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 84,
          color: COLORS.background,
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: 1600,
        }}
      >
        {scene.heading}
      </div>
      <div style={{ width: lineWidth, height: 4, backgroundColor: COLORS.gold, marginTop: 24, borderRadius: 2 }} />
    </AbsoluteFill>
  );
}
