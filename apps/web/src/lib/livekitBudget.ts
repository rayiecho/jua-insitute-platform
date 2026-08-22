import { createAdminClient } from '@/lib/supabase/admin';

// LiveKit Cloud's free "Build" plan (2026-08-22 planning discussion) — a
// real hard cap, not a soft/metered one: Build has no payment method on
// file at all, so once exceeded, new agent sessions simply fail to start
// rather than billing overage (confirmed against LiveKit's own docs — the
// overage-billing behavior only applies to the paid Ship/Scale tiers,
// which do have billing attached). Resets on the 1st of each calendar
// month. Budgeting to 100% risks a scheduled class where the agent can't
// join at all — deliberately budgeting to a safety fraction below the real
// cap instead, per an explicit "75-80%, not 100%" decision.
export const FREE_AGENT_MINUTES_PER_MONTH = 1000;
export const FREE_WEBRTC_MINUTES_PER_MONTH = 5000;
export const SAFETY_FRACTION = 0.75;

export interface LiveKitUsageSnapshot {
  agentMinutesUsed: number;
  webrtcMinutesUsed: number;
  agentMinutesBudget: number;
  webrtcMinutesBudget: number;
  agentMinutesPct: number;
  webrtcMinutesPct: number;
}

function currentMonthRangeUtc(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

// Computed from our own class_sessions/class_session_enrollments data
// rather than a LiveKit usage API — we already know exactly how many
// minutes each scheduled class actually consumes (the agent is in the room
// for the full duration; participants are whoever is actually assigned).
// Assigned-enrollment count is used as the headcount for every session,
// past or future — a deliberate worst-case estimate: it's the safe side to
// be wrong on, matching "budget to 75-80%, not exact."
export async function getMonthlyLiveKitUsage(admin: ReturnType<typeof createAdminClient>): Promise<LiveKitUsageSnapshot> {
  const { start, end } = currentMonthRangeUtc();

  const { data: sessions } = await admin
    .from('class_sessions')
    .select('id, duration_minutes')
    .neq('status', 'cancelled')
    .gte('scheduled_start', start)
    .lt('scheduled_start', end);

  const sessionList = sessions ?? [];
  const sessionIds = sessionList.map((s) => s.id);

  const counts = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: enrollments } = await admin
      .from('class_session_enrollments')
      .select('class_session_id')
      .in('class_session_id', sessionIds);
    for (const e of enrollments ?? []) {
      counts.set(e.class_session_id, (counts.get(e.class_session_id) ?? 0) + 1);
    }
  }

  let agentMinutesUsed = 0;
  let webrtcMinutesUsed = 0;
  for (const s of sessionList) {
    const headcount = counts.get(s.id) ?? 0;
    agentMinutesUsed += s.duration_minutes;
    webrtcMinutesUsed += s.duration_minutes * (headcount + 1); // +1 for the agent's own participant slot
  }

  return {
    agentMinutesUsed,
    webrtcMinutesUsed,
    agentMinutesBudget: FREE_AGENT_MINUTES_PER_MONTH * SAFETY_FRACTION,
    webrtcMinutesBudget: FREE_WEBRTC_MINUTES_PER_MONTH * SAFETY_FRACTION,
    agentMinutesPct: agentMinutesUsed / FREE_AGENT_MINUTES_PER_MONTH,
    webrtcMinutesPct: webrtcMinutesUsed / FREE_WEBRTC_MINUTES_PER_MONTH,
  };
}

// Called before creating a new class_sessions row — this check is
// headcount-independent (agent-minutes only depend on duration), since we
// don't know who'll be enrolled yet at creation time.
export async function checkAgentMinutesBudget(
  admin: ReturnType<typeof createAdminClient>,
  additionalDurationMinutes: number,
): Promise<{ allowed: boolean; usage: LiveKitUsageSnapshot }> {
  const usage = await getMonthlyLiveKitUsage(admin);
  const projected = usage.agentMinutesUsed + additionalDurationMinutes;
  return { allowed: projected <= usage.agentMinutesBudget, usage };
}

// Called before adding learners to an existing class_sessions row — this is
// where we actually know the real incremental headcount, so it checks the
// WebRTC-minutes budget (the one that scales with participants, and the
// one that runs out fastest per the group-class cost planning).
export async function checkWebrtcMinutesBudget(
  admin: ReturnType<typeof createAdminClient>,
  classDurationMinutes: number,
  additionalLearnerCount: number,
): Promise<{ allowed: boolean; usage: LiveKitUsageSnapshot }> {
  const usage = await getMonthlyLiveKitUsage(admin);
  const projected = usage.webrtcMinutesUsed + classDurationMinutes * additionalLearnerCount;
  return { allowed: projected <= usage.webrtcMinutesBudget, usage };
}
