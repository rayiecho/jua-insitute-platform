import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

// Generated favicon approximating the real Jua Institute mark (sunburst +
// hexagon) — replace with a real exported asset once the logo file is
// available; nothing else references this file so the swap is a delete.
export default function Icon() {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
          borderRadius: '50%',
        }}
      >
        <svg width="56" height="56" viewBox="0 0 48 48">
          {rays.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const r1 = 16;
            const r2 = 22;
            return (
              <line
                key={deg}
                x1={24 + r1 * Math.cos(rad)}
                y1={24 + r1 * Math.sin(rad)}
                x2={24 + r2 * Math.cos(rad)}
                y2={24 + r2 * Math.sin(rad)}
                stroke="#C8862B"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
          <circle cx="24" cy="24" r="14" fill="#C8862B" />
          <path d="M24 14 L32 19 V29 L24 34 L16 29 V19 Z" fill="none" stroke="#1C1810" strokeWidth="2" />
          <line x1="24" y1="14" x2="24" y2="34" stroke="#1C1810" strokeWidth="2" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
