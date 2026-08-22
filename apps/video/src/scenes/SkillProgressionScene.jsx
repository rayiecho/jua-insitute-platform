import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

const SKILLS = [
  { label: 'Variables', icon: 'box' },
  { label: 'Control Flow', icon: 'branch' },
  { label: 'Data Structures', icon: 'grid' },
  { label: 'Functions', icon: 'gear' },
  { label: 'OOP', icon: 'layers' },
];

function Icon({ type, color }) {
  const s = { stroke: color, strokeWidth: 4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (type) {
    case 'box':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64">
          <rect x="14" y="14" width="36" height="36" rx="4" {...s} />
        </svg>
      );
    case 'branch':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="16" cy="16" r="6" {...s} />
          <circle cx="16" cy="48" r="6" fill={color} />
          <circle cx="48" cy="32" r="6" fill={color} />
          <path d="M16 22 V 40 M16 40 L 44 32" {...s} />
        </svg>
      );
    case 'grid':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64">
          <rect x="10" y="10" width="18" height="18" rx="3" {...s} />
          <rect x="36" y="10" width="18" height="18" rx="3" {...s} />
          <rect x="10" y="36" width="18" height="18" rx="3" {...s} />
          <rect x="36" y="36" width="18" height="18" rx="3" fill={color} />
        </svg>
      );
    case 'gear':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="10" {...s} />
          {[...Array(6)].map((_, i) => {
            const a = (i * 60 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={32 + 16 * Math.cos(a)}
                y1={32 + 16 * Math.sin(a)}
                x2={32 + 24 * Math.cos(a)}
                y2={32 + 24 * Math.sin(a)}
                {...s}
              />
            );
          })}
        </svg>
      );
    case 'layers':
      return (
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path d="M32 10 L54 22 L32 34 L10 22 Z" {...s} />
          <path d="M10 34 L32 46 L54 34" {...s} />
          <path d="M10 46 L32 58 L54 46" {...s} />
        </svg>
      );
    default:
      return null;
  }
}

export function SkillProgressionScene({ fraunces }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const stepDuration = (durationInFrames - 30) / SKILLS.length;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          opacity: headerOpacity,
          fontFamily: fraunces,
          fontWeight: 600,
          fontSize: 52,
          color: COLORS.ink,
          marginBottom: 80,
        }}
      >
        Everything you'll actually build with
      </div>
      <div style={{ display: 'flex', gap: 64 }}>
        {SKILLS.map((skill, i) => {
          const start = 20 + i * stepDuration;
          const appear = spring({ frame: frame - start, fps, config: { damping: 14 } });
          const active = frame >= start;
          return (
            <div
              key={skill.label}
              style={{
                opacity: appear,
                transform: `translateY(${interpolate(appear, [0, 1], [24, 0])}px)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 20,
                  backgroundColor: active ? COLORS.gold + '22' : COLORS.card,
                  border: `2px solid ${active ? COLORS.gold : COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon type={skill.icon} color={COLORS.gold} />
              </div>
              <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 24, color: COLORS.ink, fontWeight: 600 }}>
                {skill.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
