import { AgentSessionEventTypes, ChatContext, type ConversationItemAddedEvent, type LLM, type voice } from '@livekit/agents';
import { supabase } from './supabase.js';

const TOKEN_THRESHOLD = 3000; // Section 7 — start at ~3,000 tokens, tune from real usage
const CHARS_PER_TOKEN_ESTIMATE = 4; // rough heuristic until a real tokenizer is wired in
const KEEP_LAST_MESSAGES = 4; // ~2 user/assistant turn pairs kept verbatim after compaction

// Section 4.3 — Context Compaction. Watches the active conversation buffer and,
// once it crosses the token threshold, condenses everything but the most recent
// turns into an LLM-written summary, persists it, and replaces the agent's live
// chat context so raw history doesn't grow unbounded within a session.
export class CompactionManager {
  private turnCount = 0;
  private bufferStart = 0;
  private estimatedTokens = 0;
  private compacting = false;

  constructor(
    private readonly session: voice.AgentSession,
    private readonly sessionRoomName: string,
    private readonly llm: LLM,
  ) {
    this.session.on(AgentSessionEventTypes.ConversationItemAdded, (ev) => this.onItem(ev));
  }

  private onItem(ev: ConversationItemAddedEvent) {
    const text = 'textContent' in ev.item ? (ev.item.textContent ?? '') : '';
    this.estimatedTokens += Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
    this.turnCount += 1;

    // A turn arriving mid-compaction just keeps accumulating toward the next
    // pass — compact() always reads the buffer fresh, so nothing is lost.
    if (this.estimatedTokens >= TOKEN_THRESHOLD && !this.compacting) {
      void this.compact();
    }
  }

  private async compact() {
    this.compacting = true;
    try {
      const agent = this.session.currentAgent;
      const items = agent.chatCtx.items;

      // Keep the most recent messages verbatim; everything older is a
      // candidate for summarization.
      let splitIdx = items.length;
      let messageCount = 0;
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        if (item.type === 'message' && (item.role === 'user' || item.role === 'assistant')) {
          messageCount += 1;
          if (messageCount >= KEEP_LAST_MESSAGES) {
            splitIdx = i;
            break;
          }
        }
      }

      const head = items.slice(0, splitIdx);
      const tail = items.slice(splitIdx);
      const turnRangeEnd = this.turnCount;
      const turnRangeStart = this.bufferStart;
      this.bufferStart = turnRangeEnd;
      this.estimatedTokens = 0;

      const headMessages = head.filter(
        (item): item is Extract<(typeof head)[number], { type: 'message' }> =>
          item.type === 'message' && (item.role === 'user' || item.role === 'assistant'),
      );
      const transcript = headMessages
        .map((item) => `${item.role}: ${item.textContent ?? ''}`)
        .join('\n')
        .trim();

      if (!transcript) return; // nothing old enough yet to condense

      const promptCtx = new ChatContext();
      promptCtx.addMessage({
        role: 'system',
        content:
          'Condense the following tutoring conversation into a short, faithful bullet summary: what the learner is working on, key facts/decisions, and anything unresolved. Omit greetings and small talk. 5 bullets max.',
      });
      promptCtx.addMessage({ role: 'user', content: transcript });

      let summaryText = '';
      for await (const chunk of this.llm.chat({ chatCtx: promptCtx })) {
        if (chunk.delta?.content) summaryText += chunk.delta.content;
      }
      summaryText = summaryText.trim();
      if (!summaryText) return;

      // Replace the summarized head with the condensed summary, keep the
      // verbatim tail — this is what actually keeps the in-context buffer
      // from growing unbounded within a session, not just logging that it
      // should have.
      const newCtx = new ChatContext();
      newCtx.addMessage({ role: 'system', content: `Earlier in this conversation:\n${summaryText}` });
      newCtx.insert(tail);
      await agent.updateChatCtx(newCtx);

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

      // TEMPORARILY DISABLED (2026-08-17): see the matching note in
      // continuity.ts — embedText() can block the event loop synchronously
      // via onnxruntime-node's native addon, which is worse here than on
      // session start: it would hang an *already live* call mid-conversation
      // when compaction fires. Skipping the write side until embedding
      // generation is properly isolated in a worker thread.
    } finally {
      this.compacting = false;
    }
  }

  dispose() {
    // event listeners are torn down with the session itself
  }
}
