import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

function Avatar({ label, delay, frame, fps }) {
  const appear = spring({ frame: frame - delay, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        opacity: appear,
        transform: `scale(${appear})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: '50%',
          backgroundColor: COLORS.card,
          border: `3px solid ${COLORS.gold}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke={COLORS.gold} strokeWidth="1.6">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 30, color: COLORS.background, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function LiveSessionScene({ fraunces }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse = 0.85 + 0.15 * Math.sin(frame / 6);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          opacity: headerOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 68,
          color: COLORS.background,
          marginBottom: 90,
        }}
      >
        Twice a week, live with your tutor
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 90 }}>
        <Avatar label="You" delay={15} frame={frame} fps={fps} />
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: COLORS.gold,
            transform: `scale(${pulse})`,
            boxShadow: `0 0 30px ${COLORS.gold}`,
          }}
        />
        <Avatar label="Your Tutor" delay={30} frame={frame} fps={fps} />
      </div>
      <div
        style={{
          marginTop: 76,
          opacity: interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          fontFamily: 'Arial, sans-serif',
          fontSize: 34,
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        45 minutes · real code, together
      </div>
    </AbsoluteFill>
  );
}
