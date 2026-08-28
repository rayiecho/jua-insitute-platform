// Shared admin-dashboard primitives — extracted from the identical
// `rounded-lg border border-border bg-card` / table-wrapper markup that was
// hand-repeated across every admin page. Purely presentational; each page
// keeps its own data fetching and real logic.

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card p-6 ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
}) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</p>
      {sublabel && <p className="mt-1 text-sm text-ink/60">{sublabel}</p>}
    </Card>
  );
}

const BADGE_TONES = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  neutral: 'bg-ink/10 text-ink/70',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
    </div>
  );
}
