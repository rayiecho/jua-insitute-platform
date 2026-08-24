import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

// A plain-explanation beat — no code, just the idea itself. Used for
// definitions, "why this matters," and conceptual framing between code
// demonstrations.
export function ConceptScene({ fraunces, scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingIn = spring({ frame, fps, config: { damping: 16 } });
  const lineWidth = interpolate(frame, [18, 38], [0, 140], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bodyOpacity = interpolate(frame, [28, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: '0 180px',
      }}
    >
      <div
        style={{
          opacity: headingIn,
          transform: `translateY(${interpolate(headingIn, [0, 1], [24, 0])}px)`,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 58,
          color: COLORS.ink,
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {scene.heading}
      </div>
      <div style={{ width: lineWidth, height: 4, backgroundColor: COLORS.gold, marginTop: 24, borderRadius: 2 }} />
      {scene.body && (
        <div
          style={{
            marginTop: 32,
            opacity: bodyOpacity,
            fontFamily: 'Arial, sans-serif',
            fontSize: 30,
            color: 'rgba(20,20,20,0.72)',
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: 1100,
          }}
        >
          {scene.body}
        </div>
      )}
    </AbsoluteFill>
  );
}
