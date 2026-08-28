import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader, TableShell } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

// Section 5 Phase 5 / Section 6 — cost monitoring. Costs are estimates from
// published vendor list prices logged by apps/agent/src/cost-tracking.ts at
// session close, not actual invoiced amounts — Groq's $0 LLM line is a
// free-tier stand-in, not real pricing.
const TARGET_PER_HOUR = 0.65;

interface UsageRow {
  session_id: string;
  usage_type: string;
  provider: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  characters_count: number;
  audio_duration_ms: number;
  estimated_cost_usd: number;
  created_at: string;
  session: { room_name: string; scheduled_start: string } | { room_name: string; scheduled_start: string }[] | null;
}

export default async function CostsPage() {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('session_usage_log')
    .select(
      'session_id, usage_type, provider, model, input_tokens, output_tokens, characters_count, audio_duration_ms, estimated_cost_usd, created_at, session:classroom_sessions(room_name, scheduled_start)',
    )
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as UsageRow[];

  const bySession = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.session_id) ?? [];
    list.push(row);
    bySession.set(row.session_id, list);
  }

  const sessions = Array.from(bySession.entries())
    .map(([sessionId, usageRows]) => {
      const session = Array.isArray(usageRows[0].session) ? usageRows[0].session[0] : usageRows[0].session;
      const agentRow = usageRows.find((r) => r.usage_type === 'agent_session');
      const durationHours = (agentRow?.audio_duration_ms ?? 0) / 3_600_000;
      const totalCost = usageRows.reduce((sum, r) => sum + Number(r.estimated_cost_usd), 0);
      return {
        sessionId,
        roomName: session?.room_name ?? sessionId,
        startedAt: usageRows[usageRows.length - 1].created_at,
        durationHours,
        totalCost,
        costPerHour: durationHours > 0 ? totalCost / durationHours : 0,
        breakdown: usageRows,
      };
    })
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  const totalCost = sessions.reduce((sum, s) => sum + s.totalCost, 0);
  const totalHours = sessions.reduce((sum, s) => sum + s.durationHours, 0);
  const blendedPerHour = totalHours > 0 ? totalCost / totalHours : 0;

  return (
    <div className="w-full max-w-5xl text-ink">
      <PageHeader
        title="Session cost monitoring"
        description={`Estimated from published vendor list prices at session close — not actual invoiced amounts. Target: ${formatUsd(TARGET_PER_HOUR)}/learner-hour (spec Section 6).`}
      />

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total estimated spend" value={formatUsd(totalCost)} />
        <SummaryCard label="Total learner-hours" value={totalHours.toFixed(2)} />
        <SummaryCard
          label="Blended $/learner-hour"
          value={formatUsd(blendedPerHour)}
          warn={blendedPerHour > TARGET_PER_HOUR}
        />
      </div>

      <div className="mt-10">
      <TableShell>
        <thead className="bg-card text-left">
          <tr>
            <th className="px-4 py-2">Room</th>
            <th className="px-4 py-2">Duration</th>
            <th className="px-4 py-2">Cost</th>
            <th className="px-4 py-2">$/hr</th>
            <th className="px-4 py-2">Breakdown</th>
          </tr>
        </thead>
        <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId} className="border-t border-border align-top">
                <td className="px-4 py-2 font-mono text-xs">{s.roomName}</td>
                <td className="px-4 py-2">{(s.durationHours * 60).toFixed(1)} min</td>
                <td className="px-4 py-2">{formatUsd(s.totalCost)}</td>
                <td className={`px-4 py-2 ${s.costPerHour > TARGET_PER_HOUR ? 'font-semibold text-red-600' : ''}`}>
                  {formatUsd(s.costPerHour)}
                </td>
                <td className="px-4 py-2 text-xs text-ink/60">
                  {s.breakdown
                    .filter((r) => r.usage_type !== 'agent_session')
                    .map((r) => `${r.usage_type}:${r.provider}/${r.model ?? '—'} ${formatUsd(Number(r.estimated_cost_usd))}`)
                    .join(' · ') || '—'}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={5}>
                  No sessions logged yet.
                </td>
              </tr>
            )}
          </tbody>
      </TableShell>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-ink/60">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? 'text-red-600' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

function formatUsd(value: number): string {
  return `$${value.toFixed(value < 1 ? 4 : 2)}`;
}
