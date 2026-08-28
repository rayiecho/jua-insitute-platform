// Placeholder mark approximating the real Jua Institute logo (sunburst + hex)
// until the actual asset is dropped into /public. Swap the <svg> below for an
// <Image src="/logo.png" /> once that file exists — nothing else needs to change.
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden>
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const r1 = 17;
        const r2 = 22;
        // Math.cos/Math.sin can differ in the last decimal place between
        // the server's and the browser's trig implementations — confirmed
        // live as a real hydration-mismatch warning on every page load.
        // Rounding to 3 decimals (invisible at this SVG scale) makes the
        // server and client markup byte-identical.
        const round = (n: number) => Math.round(n * 1000) / 1000;
        return (
          <line
            key={i}
            x1={round(24 + r1 * Math.cos(angle))}
            y1={round(24 + r1 * Math.sin(angle))}
            x2={round(24 + r2 * Math.cos(angle))}
            y2={round(24 + r2 * Math.sin(angle))}
            stroke="var(--color-gold)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="24" cy="24" r="13" fill="var(--color-gold)" />
      <path d="M24 15 L31 19.5 V28.5 L24 33 L17 28.5 V19.5 Z" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
      <line x1="24" y1="15" x2="24" y2="33" stroke="var(--color-ink)" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8" />
      <span className="flex items-baseline gap-1.5">
        <span className="font-serif text-xl font-semibold leading-none text-ink">Jua</span>
        <span className="text-[0.65rem] font-medium tracking-[0.2em] text-tan uppercase leading-none">
          Institute
        </span>
      </span>
    </div>
  );
}
