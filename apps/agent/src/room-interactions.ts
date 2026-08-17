import { RoomEvent, type Room } from '@livekit/rtc-node';
import type { voice } from '@livekit/agents';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function publishJson(room: Room, topic: string, payload: unknown) {
  if (!room.localParticipant) return;
  void room.localParticipant.publishData(textEncoder.encode(JSON.stringify(payload)), { reliable: true, topic });
}

// Announces the lesson's prepared video into the room so the web/mobile
// client can show it in the session guide panel. Fired once, shortly after
// the opening line, rather than mid-conversation — deciding WHEN to bring it
// up based on what's actually being discussed would need LLM tool-calling,
// which this doesn't do yet.
export function publishPreparedVideo(room: Room, video: { title: string; url: string }) {
  publishJson(room, 'shared-video', video);
}

// Section 4.1-style live interaction, but client → tutor instead of
// code-state → tutor: when a learner raises their hand, inject it into the
// agent's live chat context (same Agent.updateChatCtx path as
// state-injection.ts — see that file for why session.chatCtx itself is a
// no-op) so the tutor actually notices and responds, rather than the hand
// raise being a purely cosmetic UI toggle.
export class HandRaiseListener {
  constructor(
    private readonly room: Room,
    private readonly session: voice.AgentSession,
  ) {
    this.room.on(RoomEvent.DataReceived, this.onData);
  }

  private onData = (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
    if (topic !== 'hand-raise') return;
    try {
      const msg = JSON.parse(textDecoder.decode(payload)) as { raised: boolean; name?: string };
      if (!msg.raised) return;
      void this.inject(msg.name);
    } catch {
      // malformed payload — ignore
    }
  };

  private async inject(name?: string) {
    const agent = this.session.currentAgent;
    const ctx = agent.chatCtx.copy();
    ctx.addMessage({
      role: 'system',
      content: `[${name ?? 'The learner'} just raised their hand asking for your attention. Acknowledge them by name and pause to ask what they need before continuing your point.]`,
    });
    await agent.updateChatCtx(ctx);
  }

  dispose() {
    this.room.off(RoomEvent.DataReceived, this.onData);
  }
}
