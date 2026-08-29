// Decorative, non-interactive wave band for the footer. Two layers scroll
// horizontally in opposite directions at different speeds, each also
// bobbing vertically — real motion instead of a flat printed pattern, kept
// strictly to the brand's own gold/ink tones (no new colors introduced).
// Pure CSS animation (transform only), no JS, no external assets.
const TILE = 'M0,50 C 90,100 180,0 360,50 C 540,100 630,0 720,50 V120 H0 Z M720,50 C 810,100 900,0 1080,50 C 1260,100 1350,0 1440,50 V120 H720 Z';

export function WaveDivider() {
  return (
    <div className="relative h-24 w-full overflow-hidden sm:h-32" aria-hidden>
      <div
        className="absolute inset-0 flex w-[200%]"
        style={{ animation: 'wave-scroll-x 14s linear infinite' }}
      >
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="h-full w-1/2 shrink-0"
          style={{ animation: 'wave-bob-y 5s ease-in-out infinite' }}
        >
          <path d={TILE} fill="var(--color-brand)" fillOpacity="0.16" />
        </svg>
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="h-full w-1/2 shrink-0"
          style={{ animation: 'wave-bob-y 5s ease-in-out infinite' }}
        >
          <path d={TILE} fill="var(--color-brand)" fillOpacity="0.16" />
        </svg>
      </div>
      <div
        className="absolute inset-0 flex w-[200%]"
        style={{ animation: 'wave-scroll-x 9s linear infinite reverse' }}
      >
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="h-full w-1/2 shrink-0 translate-y-4"
          style={{ animation: 'wave-bob-y 3.5s ease-in-out infinite reverse' }}
        >
          <path d={TILE} fill="var(--color-ink)" fillOpacity="0.08" />
        </svg>
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="h-full w-1/2 shrink-0 translate-y-4"
          style={{ animation: 'wave-bob-y 3.5s ease-in-out infinite reverse' }}
        >
          <path d={TILE} fill="var(--color-ink)" fillOpacity="0.08" />
        </svg>
      </div>
    </div>
  );
}
