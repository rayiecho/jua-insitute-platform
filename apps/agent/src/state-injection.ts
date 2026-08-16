import type { voice } from '@livekit/agents';
import { supabase } from './supabase.js';

const DEBOUNCE_MS = 1750; // Section 7 — start at ~1.5–2s, tune from real usage
const REALTIME_TABLE = 'student_assignments_progress';

// Section 4.1 — Shared Focus. Injects the learner's live code/design/draft state
// into the LLM prompt, but only on a debounced pause-in-typing or when the
// learner starts speaking — never on every keystroke.
export class StateInjector {
  private latestState: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private channel: ReturnType<typeof supabase.channel>;

  constructor(
    private readonly session: voice.AgentSession,
    private readonly learnerId: string,
  ) {
    this.channel = supabase
      .channel(`state-injection:${this.learnerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: REALTIME_TABLE, filter: `user_id=eq.${this.learnerId}` },
        (payload) => this.onStateChange(payload.new.current_code_state as string | null),
      )
      .subscribe();
  }

  private onStateChange(newState: string | null) {
    this.latestState = newState;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  /** Called from the VAD "user started speaking" event — flush immediately, skip the debounce wait. */
  flushOnSpeechStart() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.flush();
  }

  private flush() {
    this.debounceTimer = null;
    if (this.latestState === null) return;
    // Appended as a system message so it's present in context for the next LLM
    // turn without triggering a reply itself (Section 4.1).
    this.session.chatCtx.addMessage({
      role: 'system',
      content: `[Current Student State: ${this.latestState}]`,
    });
    this.latestState = null;
  }

  dispose() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    void supabase.removeChannel(this.channel);
  }
}
