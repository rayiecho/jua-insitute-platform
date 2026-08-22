import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

const LINES = [
  { text: 'def average(scores):', color: '#e8ddc9' },
  { text: '    return sum(scores) / len(scores)', color: '#c8862b' },
  { text: '', color: '#e8ddc9' },
  { text: 'print(average([85, 92, 78]))', color: '#e8ddc9' },
];

export function PracticeScene({ fraunces }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const windowIn = spring({ frame: frame - 15, fps, config: { damping: 16 } });
  const checkIn = spring({ frame: frame - 65, fps, config: { damping: 12 } });

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
        Real practice. Real feedback.
      </div>
      <div
        style={{
          opacity: windowIn,
          transform: `translateY(${interpolate(windowIn, [0, 1], [30, 0])}px)`,
          width: 820,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          position: 'relative',
        }}
      >
        <div style={{ backgroundColor: COLORS.ink, padding: '16px 24px', display: 'flex', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#e0605088' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#e0c05088' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#60c05088' }} />
        </div>
        <div style={{ backgroundColor: COLORS.ink, padding: '28px 32px 40px' }}>
          {LINES.map((line, i) => (
            <div key={i} style={{ fontFamily: 'Courier New, monospace', fontSize: 26, color: line.color, lineHeight: 1.7 }}>
              {line.text || ' '}
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            top: -22,
            right: -22,
            opacity: checkIn,
            transform: `scale(${checkIn})`,
            width: 72,
            height: 72,
            borderRadius: '50%',
            backgroundColor: COLORS.gold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(200,134,43,0.4)',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={COLORS.ink} strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
}
