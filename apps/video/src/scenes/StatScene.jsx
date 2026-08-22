import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS } from '../theme';

export function StatScene({ fraunces }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const numberScale = spring({ frame, fps, config: { damping: 10, mass: 0.7 } });
  const labelOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <div
        style={{
          transform: `scale(${numberScale})`,
          fontFamily: fraunces,
          fontWeight: 700,
          fontSize: 320,
          color: COLORS.gold,
          lineHeight: 1,
        }}
      >
        #1
      </div>
      <div
        style={{
          opacity: labelOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 50,
          color: COLORS.background,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        Most in-demand language for beginners
      </div>
      <div
        style={{
          opacity: subOpacity,
          fontFamily: 'Arial, sans-serif',
          fontSize: 28,
          color: 'rgba(255,255,255,0.55)',
          marginTop: 20,
        }}
      >
        TIOBE Index · Stack Overflow Developer Survey · GitHub Octoverse
      </div>
    </AbsoluteFill>
  );
}
