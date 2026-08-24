import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS } from '../theme';

const WEEKS = 13;

export function RoadmapScene({ fraunces }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // The "current position" travels across all 13 nodes over the scene's own
  // real duration (driven by the actual narration length, not a guess).
  const progress = interpolate(frame, [30, durationInFrames - 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const litCount = Math.floor(progress * WEEKS);

  const nodeGap = 132;
  const totalWidth = (WEEKS - 1) * nodeGap;
  const glowOpacity = interpolate(frame, [0, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <div
        style={{
          position: 'absolute',
          top: -280,
          right: -280,
          width: 900,
          height: 900,
          borderRadius: '50%',
          opacity: glowOpacity * 0.12,
          background: `radial-gradient(circle, ${COLORS.gold} 0%, transparent 68%)`,
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          opacity: headerOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 72,
          color: COLORS.ink,
          marginBottom: 110,
        }}
      >
        13 weeks. Zero to real programs.
      </div>
      <div style={{ position: 'relative', width: totalWidth, height: 24 }}>
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 0,
            width: totalWidth,
            height: 4,
            backgroundColor: COLORS.border,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 0,
            width: totalWidth * progress,
            height: 4,
            backgroundColor: COLORS.gold,
            borderRadius: 2,
          }}
        />
        {[...Array(WEEKS)].map((_, i) => {
          const lit = i <= litCount;
          const isFinal = i === WEEKS - 1;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: i * nodeGap - 15,
                top: -11,
                width: 34,
                height: 34,
                borderRadius: '50%',
                backgroundColor: lit ? COLORS.gold : COLORS.card,
                border: `3px solid ${lit ? COLORS.gold : COLORS.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'none',
              }}
            >
              {isFinal && (
                <div style={{ position: 'absolute', top: 40, fontSize: 20, color: COLORS.ink, whiteSpace: 'nowrap', fontFamily: 'Arial, sans-serif' }}>
                  Final
                </div>
              )}
            </div>
          );
        })}
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
