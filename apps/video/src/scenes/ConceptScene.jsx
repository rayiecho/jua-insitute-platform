import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

// A plain-explanation beat — no code, just the idea itself. Used for
// definitions, "why this matters," and conceptual framing between code
// demonstrations.
//
// Redesigned 2026-08-24: the first pass centered a modest block of text in
// the middle of a 1920x1080 canvas, leaving most of the frame empty
// (real feedback: "most of our video screen is not utilized"). This version
// uses the full width, left-aligns for a stronger read, and fills the right
// side with a soft brand glow instead of bare background.
export function ConceptScene({ fraunces, scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingIn = spring({ frame, fps, config: { damping: 16 } });
  const lineWidth = interpolate(frame, [18, 38], [0, 180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bodyOpacity = interpolate(frame, [28, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowOpacity = interpolate(frame, [0, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <div
        style={{
          position: 'absolute',
          top: -260,
          right: -260,
          width: 900,
          height: 900,
          borderRadius: '50%',
          opacity: glowOpacity * 0.14,
          background: `radial-gradient(circle, ${COLORS.gold} 0%, transparent 68%)`,
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 110px' }}>
        <div
          style={{
            opacity: headingIn,
            transform: `translateY(${interpolate(headingIn, [0, 1], [24, 0])}px)`,
            fontFamily: fraunces,
            fontWeight: 600,
            fontSize: 96,
            color: COLORS.ink,
            lineHeight: 1.1,
            maxWidth: 1700,
          }}
        >
          {scene.heading}
        </div>
        <div style={{ width: lineWidth, height: 5, backgroundColor: COLORS.gold, marginTop: 36, borderRadius: 2 }} />
        {scene.body && (
          <div
            style={{
              marginTop: 44,
              opacity: bodyOpacity,
              fontFamily: 'Arial, sans-serif',
              fontSize: 44,
              color: 'rgba(20,20,20,0.72)',
              lineHeight: 1.55,
              maxWidth: 1560,
            }}
          >
            {scene.body}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
