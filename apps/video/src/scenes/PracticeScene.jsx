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
          fontSize: 68,
          color: COLORS.ink,
          marginBottom: 76,
        }}
      >
        Real practice. Real feedback.
      </div>
      <div
        style={{
          opacity: windowIn,
          transform: `translateY(${interpolate(windowIn, [0, 1], [30, 0])}px)`,
          width: 1080,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(0,0,0,0.15)',
          position: 'relative',
        }}
      >
        <div style={{ backgroundColor: COLORS.ink, padding: '18px 28px', display: 'flex', gap: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#e0605088' }} />
          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#e0c05088' }} />
          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#60c05088' }} />
        </div>
        <div style={{ backgroundColor: COLORS.ink, padding: '44px 44px 56px' }}>
          {LINES.map((line, i) => (
            <div key={i} style={{ fontFamily: 'Courier New, monospace', fontSize: 34, color: line.color, lineHeight: 1.7 }}>
              {line.text || ' '}
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            top: -28,
            right: -28,
            opacity: checkIn,
            transform: `scale(${checkIn})`,
            width: 92,
            height: 92,
            borderRadius: '50%',
            backgroundColor: COLORS.gold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(200,134,43,0.4)',
          }}
        >
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={COLORS.ink} strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
}
