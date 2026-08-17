import type { voice } from '@livekit/agents';
import { supabase } from './supabase.js';

// Section 5 Phase 5 / Section 6 — cost monitoring. Rates below are published
// list prices, checked 2026-08-17 (livekit.com/pricing, deepgram.com/pricing)
// — not pulled from an invoice, so treat `estimated_cost_usd` as an estimate,
// not exact billing. Revisit whenever a vendor changes (see README "Known
// temporary substitutions" — Groq is a free-tier stand-in for OpenAI/Claude,
// so its $0 line item is NOT representative of eventual real cost).
const RATES = {
  agentSessionPerMinute: 0.01, // LiveKit Cloud flat agent-minute fee
  livekitSttPerMinute: 0.0048, // LiveKit inference gateway, Deepgram nova tier
  deepgramAuraPer1kChars: 0.03, // Deepgram Aura-2 TTS, direct
  groqPerToken: 0, // free tier during development — see comment above
} as const;

function costOf(usageType: 'agent_session' | 'llm' | 'tts' | 'stt', fields: {
  durationMs?: number;
  characters?: number;
  inputTokens?: number;
  outputTokens?: number;
}): number {
  switch (usageType) {
    case 'agent_session':
      return ((fields.durationMs ?? 0) / 60_000) * RATES.agentSessionPerMinute;
    case 'stt':
      return ((fields.durationMs ?? 0) / 60_000) * RATES.livekitSttPerMinute;
    case 'tts':
      return ((fields.characters ?? 0) / 1000) * RATES.deepgramAuraPer1kChars;
    case 'llm':
      return ((fields.inputTokens ?? 0) + (fields.outputTokens ?? 0)) * RATES.groqPerToken;
  }
}

// Logs per-session usage/cost at session close. Best-effort — a missed log
// means one session is invisible to the dashboard, not a broken session.
export async function logSessionUsage(
  session: voice.AgentSession,
  roomName: string,
  sessionStartedAt: number,
) {
  try {
    const { data: sessionRow } = await supabase
      .from('classroom_sessions')
      .select('id')
      .eq('room_name', roomName)
      .maybeSingle();
    if (!sessionRow) return;

    const durationMs = Date.now() - sessionStartedAt;
    const rows: Array<{
      session_id: string;
      usage_type: string;
      provider: string;
      model: string | null;
      input_tokens: number;
      output_tokens: number;
      characters_count: number;
      audio_duration_ms: number;
      estimated_cost_usd: number;
    }> = [
      {
        session_id: sessionRow.id,
        usage_type: 'agent_session',
        provider: 'livekit',
        model: null,
        input_tokens: 0,
        output_tokens: 0,
        characters_count: 0,
        audio_duration_ms: durationMs,
        estimated_cost_usd: costOf('agent_session', { durationMs }),
      },
    ];

    for (const usage of session.usage.modelUsage) {
      if (usage.type === 'llm_usage') {
        rows.push({
          session_id: sessionRow.id,
          usage_type: 'llm',
          provider: usage.provider ?? 'unknown',
          model: usage.model ?? null,
          input_tokens: usage.inputTokens ?? 0,
          output_tokens: usage.outputTokens ?? 0,
          characters_count: 0,
          audio_duration_ms: 0,
          estimated_cost_usd: costOf('llm', {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          }),
        });
      } else if (usage.type === 'tts_usage') {
        rows.push({
          session_id: sessionRow.id,
          usage_type: 'tts',
          provider: usage.provider ?? 'unknown',
          model: usage.model ?? null,
          input_tokens: 0,
          output_tokens: 0,
          characters_count: usage.charactersCount ?? 0,
          audio_duration_ms: usage.audioDurationMs ?? 0,
          estimated_cost_usd: costOf('tts', { characters: usage.charactersCount }),
        });
      } else if (usage.type === 'stt_usage') {
        rows.push({
          session_id: sessionRow.id,
          usage_type: 'stt',
          provider: usage.provider ?? 'unknown',
          model: usage.model ?? null,
          input_tokens: usage.inputTokens ?? 0,
          output_tokens: 0,
          characters_count: 0,
          audio_duration_ms: usage.audioDurationMs ?? 0,
          estimated_cost_usd: costOf('stt', { durationMs: usage.audioDurationMs }),
        });
      }
    }

    await supabase.from('session_usage_log').insert(rows);
  } catch {
    // best-effort, see comment above
  }
}
