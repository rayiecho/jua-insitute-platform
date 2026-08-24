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
          fontSize: 68,
          color: COLORS.ink,
          marginBottom: 76,
        }}
      >
        Nothing to install
      </div>
      <div
        style={{
          opacity: windowIn,
          transform: `translateY(${interpolate(windowIn, [0, 1], [30, 0])}px)`,
          width: 1080,
          borderRadius: 18,
          overflow: 'hidden',
          border: `2px solid ${COLORS.border}`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.card,
            padding: '18px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#e06050' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#e0c050' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#60c050' }} />
          </div>
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'Arial, sans-serif',
              fontSize: 24,
              color: COLORS.ink,
              opacity: 0.5,
            }}
          >
            jua-institute.com
          </div>
        </div>
        <div style={{ backgroundColor: COLORS.ink, padding: '56px 44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 34, color: '#e8ddc9' }}>
            print("Hello, world!")
          </div>
          <div
            style={{
              backgroundColor: COLORS.gold,
              color: COLORS.ink,
              fontFamily: 'Arial, sans-serif',
              fontWeight: 700,
              fontSize: 28,
              padding: '14px 28px',
              borderRadius: 10,
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
