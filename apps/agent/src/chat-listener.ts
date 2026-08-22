import type { Room } from '@livekit/rtc-node';
import type { voice } from '@livekit/agents';
import { supabase } from './supabase.js';

const CHAT_TOPIC = 'lk.chat'; // LiveKit's standard text-stream topic — matches useChat() on the web client

// "Just like Google Meet, people can type in chat, and the tutor must be
// able to get what is typed" — the web client's chat panel (TeachingScreen
// sibling, see apps/web/src/components/tutor/ChatPanel.tsx) sends messages
// over LiveKit's built-in text-stream protocol via useChat(), which is a
// higher-level API on the browser SDK. rtc-node exposes the same protocol
// at a lower level (registerTextStreamHandler), so this reads it directly
// rather than adding a second, custom data-channel just for chat.
export class ChatListener {
  constructor(
    private readonly room: Room,
    private readonly session: voice.AgentSession,
  ) {
    this.room.registerTextStreamHandler(CHAT_TOPIC, this.onText);
  }

  private onText = (reader: { readAll: () => Promise<string> }, participantInfo: { identity: string }) => {
    void (async () => {
      try {
        const text = (await reader.readAll()).trim();
        if (!text) return;
        const name = await resolveLearnerName(participantInfo.identity);
        await this.respond(name, text);
      } catch (err) {
        console.error('[chat] failed to handle incoming chat message:', err);
      }
    })();
  };

  // Typed chat is still a real question that deserves a real answer, not
  // just passive context waiting for the next natural turn (unlike
  // HandRaiseListener's system-message injection) — so this both adds it to
  // the transcript AND actively triggers a reply.
  private async respond(name: string, text: string) {
    const agent = this.session.currentAgent;
    const ctx = agent.chatCtx.copy();
    ctx.addMessage({ role: 'user', content: `[${name} typed this in the chat, instead of speaking]: ${text}` });
    await agent.updateChatCtx(ctx);
    await this.session.generateReply();
  }

  dispose() {
    this.room.unregisterTextStreamHandler(CHAT_TOPIC);
  }
}

async function resolveLearnerName(identity: string): Promise<string> {
  const { data } = await supabase.from('platform_users').select('first_name').eq('id', identity).maybeSingle();
  return data?.first_name ?? 'The learner';
}
