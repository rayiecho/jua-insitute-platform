import { AgentSessionEventTypes, type ConversationItemAddedEvent, type voice } from '@livekit/agents';
import { supabase } from './supabase.js';

const TOKEN_THRESHOLD = 3000; // Section 7 — start at ~3,000 tokens, tune from real usage
const CHARS_PER_TOKEN_ESTIMATE = 4; // rough heuristic until a real tokenizer is wired in

// Section 4.3 — Context Compaction. Watches the active conversation buffer and,
// once it crosses the token threshold, hands the buffer to a background worker
// that condenses it into a bullet summary, persists it, and clears the in-context
// buffer so raw history never grows unbounded within a session.
export class CompactionManager {
  private turnCount = 0;
  private bufferStart = 0;
  private estimatedTokens = 0;

  constructor(
    private readonly session: voice.AgentSession,
    private readonly sessionRoomName: string,
  ) {
    this.session.on(AgentSessionEventTypes.ConversationItemAdded, (ev) => this.onItem(ev));
  }

  private onItem(ev: ConversationItemAddedEvent) {
    const text = 'textContent' in ev.item ? (ev.item.textContent ?? '') : '';
    this.estimatedTokens += Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
    this.turnCount += 1;

    if (this.estimatedTokens >= TOKEN_THRESHOLD) {
      void this.compact();
    }
  }

  private async compact() {
    const turnRangeEnd = this.turnCount;
    const turnRangeStart = this.bufferStart;
    this.bufferStart = turnRangeEnd;
    this.estimatedTokens = 0;

    // TODO: pull the actual chat history out of `this.session`, send it to the LLM
    // for condensation into a bullet summary. Placeholder below just marks the
    // boundary so the schema and trigger logic are provable end-to-end.
    const summaryText = `[compaction pending] turns ${turnRangeStart}-${turnRangeEnd}`;

    const { data: sessionRow } = await supabase
      .from('classroom_sessions')
      .select('id')
      .eq('room_name', this.sessionRoomName)
      .maybeSingle();

    if (!sessionRow) return;

    await supabase.from('conversation_summaries').insert({
      session_id: sessionRow.id,
      summary_text: summaryText,
      turn_range_start: turnRangeStart,
      turn_range_end: turnRangeEnd,
    });

    // TODO: clear/truncate the in-context buffer on `this.session` once the real
    // history extraction above is wired in — verify the truncation API against
    // the installed @livekit/agents version.
  }

  dispose() {
    // event listeners are torn down with the session itself
  }
}
