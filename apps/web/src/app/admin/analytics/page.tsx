import { createAdminClient } from '@/lib/supabase/admin';

// CAT = Central Africa Time, UTC+2, no DST — the timezone this admin
// dashboard is read in. datetime-local inputs below are interpreted as CAT
// and converted to UTC for the actual query, since Supabase stores
// timestamps in UTC.
const CAT_OFFSET_HOURS = 2;

function catInputToUtcIso(value: string): string {
  // value looks like "2026-08-18T18:00" (no timezone) — treat it as CAT.
  const [datePart, timePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh - CAT_OFFSET_HOURS, mm);
  return new Date(utcMs).toISOString();
}

function utcToCatInputValue(date: Date): string {
  const catMs = date.getTime() + CAT_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(catMs).toISOString().slice(0, 16);
}

function classifySource(referrer: string | null): string {
  if (!referrer) return 'Direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host.includes('google.')) return 'Google';
    if (['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com'].some((s) => host.includes(s))) {
      return 'Social';
    }
    return host;
  } catch {
    return 'Direct';
  }
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();

  const now = new Date();
  const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sevenDaysAgoUtc = new Date(todayStartUtc.getTime() - 6 * 24 * 60 * 60 * 1000);

  const rangeFromUtc = params.from ? catInputToUtcIso(params.from) : sevenDaysAgoUtc.toISOString();
  const rangeToUtc = params.to ? catInputToUtcIso(params.to) : new Date().toISOString();

  const [{ data: todayRows }, { data: weekRows }, { data: allTimeCountRows }, { data: rangeRows }] = await Promise.all([
    admin.from('page_views').select('visitor_id').gte('created_at', todayStartUtc.toISOString()),
    admin.from('page_views').select('visitor_id, created_at').gte('created_at', sevenDaysAgoUtc.toISOString()),
    admin.from('page_views').select('visitor_id'),
    admin.from('page_views').select('visitor_id, path, referrer, created_at').gte('created_at', rangeFromUtc).lte('created_at', rangeToUtc),
  ]);

  const todayUnique = new Set((todayRows ?? []).map((r) => r.visitor_id)).size;
  const allTimeUnique = new Set((allTimeCountRows ?? []).map((r) => r.visitor_id)).size;
  const allTimeViews = (allTimeCountRows ?? []).length;

  // Daily breakdown for the last 7 days, bucketed in CAT so "today" lines up
  // with what the admin actually experiences as today.
  const dayBuckets = new Map<string, Set<string>>();
  for (const row of weekRows ?? []) {
    const catDate = new Date(new Date(row.created_at).getTime() + CAT_OFFSET_HOURS * 60 * 60 * 1000);
    const key = catDate.toISOString().slice(0, 10);
    if (!dayBuckets.has(key)) dayBuckets.set(key, new Set());
    dayBuckets.get(key)!.add(row.visitor_id);
  }
  const days: { date: string; uniqueVisitors: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStartUtc.getTime() - i * 24 * 60 * 60 * 1000 + CAT_OFFSET_HOURS * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, uniqueVisitors: dayBuckets.get(key)?.size ?? 0 });
  }

  // Custom range stats
  const rangeUniqueVisitors = new Set((rangeRows ?? []).map((r) => r.visitor_id)).size;
  const rangeViews = (rangeRows ?? []).length;
  const sourceCounts = new Map<string, number>();
  const pathCounts = new Map<string, number>();
  for (const row of rangeRows ?? []) {
    const source = classifySource(row.referrer);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    pathCounts.set(row.path, (pathCounts.get(row.path) ?? 0) + 1);
  }
  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topPaths = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const defaultFrom = utcToCatInputValue(sevenDaysAgoUtc);
  const defaultTo = utcToCatInputValue(new Date());

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Analytics</h1>
      <p className="mt-1 text-sm text-ink/60">
        Real page-view tracking, starting from when this was built (2026-08-19) — there&apos;s no data from before
        that, since nothing was tracking visits yet.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Unique visitors today" value={String(todayUnique)} />
        <StatCard label="All-time unique visitors" value={String(allTimeUnique)} />
        <StatCard label="All-time page views" value={String(allTimeViews)} />
      </div>

      <h2 className="mt-10 font-serif text-xl font-semibold text-ink">Last 7 days</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-left">
            <tr>
              <th className="px-4 py-2">Date (CAT)</th>
              <th className="px-4 py-2">Unique visitors</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="px-4 py-2 text-ink">{d.date}</td>
                <td className="px-4 py-2 text-ink/70">{d.uniqueVisitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-serif text-xl font-semibold text-ink">Custom date range</h2>
      <p className="mt-1 text-xs text-ink/50">Times are interpreted as CAT (Central Africa Time, UTC+2).</p>
      <form className="mt-3 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">From</label>
          <input
            type="datetime-local"
            name="from"
            defaultValue={params.from ?? defaultFrom}
            className="rounded border border-border bg-card px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">To</label>
          <input
            type="datetime-local"
            name="to"
            defaultValue={params.to ?? defaultTo}
            className="rounded border border-border bg-card px-3 py-2 text-sm text-ink"
          />
        </div>
        <button type="submit" className="rounded bg-gold px-4 py-2 text-sm font-semibold text-ink">
          Update
        </button>
      </form>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Unique visitors in range" value={String(rangeUniqueVisitors)} />
        <StatCard label="Page views in range" value={String(rangeViews)} />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink">Top sources</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody>
                {topSources.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-ink/50" colSpan={2}>
                      No data in this range
                    </td>
                  </tr>
                )}
                {topSources.map(([source, count]) => (
                  <tr key={source} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-ink">{source}</td>
                    <td className="px-4 py-2 text-right text-ink/60">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-serif text-lg font-semibold text-ink">Top pages</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody>
                {topPaths.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-ink/50" colSpan={2}>
                      No data in this range
                    </td>
                  </tr>
                )}
                {topPaths.map(([path, count]) => (
                  <tr key={path} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-ink">{path}</td>
                    <td className="px-4 py-2 text-right text-ink/60">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <p className="font-serif text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/50">{label}</p>
    </div>
  );
}
