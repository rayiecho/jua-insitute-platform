import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';
import { JuaLogo } from '../JuaLogo';

export function ClosingScene({ fraunces }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const textOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lineWidth = interpolate(frame, [45, 65], [0, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.ink,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <div style={{ transform: `scale(${logoScale})` }}>
        <JuaLogo size={110} />
      </div>
      <div
        style={{
          marginTop: 40,
          opacity: textOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 76,
          color: COLORS.background,
        }}
      >
        Let's start.
      </div>
      <div style={{ width: lineWidth, height: 4, backgroundColor: COLORS.gold, marginTop: 24, borderRadius: 2 }} />
    </AbsoluteFill>
  );
}
