import { fileURLToPath } from 'node:url';
import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  AgentSessionEventTypes,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as openai from '@livekit/agents-plugin-openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as silero from '@livekit/agents-plugin-silero';

import { buildOpeningContext } from './continuity.js';
import { StateInjector } from './state-injection.js';
import { CompactionManager } from './compaction.js';
import { logConnectionEvent } from './supabase.js';

// Section 4.1 / 4.2 / 4.3 of platform-technical-specification-mvp.md drive the
// shape of this worker. Each numbered section below maps to one behavior
// requirement from the spec — keep the mapping when this file grows.

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // TODO(Phase 2): resolve real learnerId/sessionId from ctx.room metadata
    // or job dispatch metadata once the booking flow exists. Placeholder wiring
    // for now so the loop is end-to-end runnable against a test room.
    const learnerId = ctx.job.metadata || 'unknown-learner';

    const opening = await buildOpeningContext(learnerId); // Section 4.4

    const session = new voice.AgentSession({
      stt: new deepgram.STT({ model: 'nova-2', language: 'en' }),
      llm: new openai.LLM({ model: 'gpt-4o-mini' }),
      tts: new cartesia.TTS({
        model: 'sonic-3',
        voice: process.env.CARTESIA_VOICE_ID ?? '',
      }),
      vad: await silero.VAD.load(),
      turnHandling: {
        interruption: { mode: 'vad', enabled: true }, // Section 4.2 — VAD interruption throttle
      },
    });

    const stateInjector = new StateInjector(session, learnerId); // Section 4.1 — shared focus
    const compaction = new CompactionManager(session, ctx.room.name ?? 'unknown-room'); // Section 4.3

    // Section 4.2 — interruption must be a server-side event, not client-triggered, so it
    // survives mobile network jitter. AgentSession's own VAD-mode interruption (configured
    // above) already cancels in-flight LLM/TTS generation server-side; this handler is the
    // hook point for additional server-side cleanup if that turns out to be insufficient
    // once real mobile testing starts, and also drives the shared-focus flush (Section 4.1).
    session.on(AgentSessionEventTypes.UserStateChanged, (ev) => {
      if (ev.newState === 'speaking') stateInjector.flushOnSpeechStart();
    });
    session.on(AgentSessionEventTypes.Close, () => {
      stateInjector.dispose();
      compaction.dispose();
    });

    await session.start({
      agent: voice.Agent.create({ instructions: opening.systemPrompt }),
      room: ctx.room,
    });

    await ctx.connect();
    await logConnectionEvent(ctx.room.name ?? 'unknown-room', 'connected'); // Section 4.5

    await session.generateReply({ instructions: opening.openingLine });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'ai-tutor',
  }),
);
