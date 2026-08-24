import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';
import { JuaLogo } from '../JuaLogo';

export function ClosingScene({ fraunces }) {
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
      }}
    >
      <div style={{ transform: `scale(${logoScale})` }}>
        <JuaLogo size={130} />
      </div>
      <div
        style={{
          marginTop: 48,
          opacity: textOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 92,
          color: COLORS.background,
        }}
      >
        Let's start.
      </div>
      <div style={{ width: lineWidth, height: 5, backgroundColor: COLORS.gold, marginTop: 30, borderRadius: 2 }} />
    </AbsoluteFill>
  );
}
