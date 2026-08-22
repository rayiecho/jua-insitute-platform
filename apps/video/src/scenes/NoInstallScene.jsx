import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

export function NoInstallScene({ fraunces }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const windowIn = spring({ frame: frame - 15, fps, config: { damping: 16 } });
  const runGlow = interpolate(frame % 60, [0, 30, 60], [0.3, 1, 0.3]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          opacity: headerOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 52,
          color: COLORS.ink,
          marginBottom: 56,
        }}
      >
        Nothing to install
      </div>
      <div
        style={{
          opacity: windowIn,
          transform: `translateY(${interpolate(windowIn, [0, 1], [30, 0])}px)`,
          width: 760,
          borderRadius: 16,
          overflow: 'hidden',
          border: `2px solid ${COLORS.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.card,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#e06050' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#e0c050' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#60c050' }} />
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'Arial, sans-serif',
              fontSize: 20,
              color: COLORS.ink,
              opacity: 0.5,
            }}
          >
            jua-institute.vercel.app
          </div>
        </div>
        <div style={{ backgroundColor: COLORS.ink, padding: '40px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 26, color: '#e8ddc9' }}>
            print("Hello, world!")
          </div>
          <div
            style={{
              backgroundColor: COLORS.gold,
              color: COLORS.ink,
              fontFamily: 'Arial, sans-serif',
              fontWeight: 700,
              fontSize: 22,
              padding: '10px 22px',
              borderRadius: 8,
              opacity: runGlow,
            }}
          >
            ▶ Run
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
