import React from 'react';
import { COLORS } from './theme';

// The real Jua Institute mark (apps/web/src/components/brand/Logo.tsx),
// replicated exactly — same 12-ray sunburst, gold disc, ink hexagon — so the
// video is recognizably the same brand, not a lookalike drawn from scratch.
export function JuaLogo({ size = 96, scale = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ transform: `scale(${scale})` }}>
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const r1 = 17;
        const r2 = 22;
        return (
          <line
            key={i}
            x1={24 + r1 * Math.cos(angle)}
            y1={24 + r1 * Math.sin(angle)}
            x2={24 + r2 * Math.cos(angle)}
            y2={24 + r2 * Math.sin(angle)}
            stroke={COLORS.gold}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="24" cy="24" r="13" fill={COLORS.gold} />
      <path d="M24 15 L31 19.5 V28.5 L24 33 L17 28.5 V19.5 Z" fill="none" stroke={COLORS.ink} strokeWidth="1.5" />
      <line x1="24" y1="15" x2="24" y2="33" stroke={COLORS.ink} strokeWidth="1.5" />
    </svg>
  );
}
