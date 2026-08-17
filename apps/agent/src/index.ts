import './env.js';

import { fileURLToPath } from 'node:url';
import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  AgentSessionEventTypes,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';

import { buildOpeningContext } from './continuity.js';
import { StateInjector } from './state-injection.js';
import { CompactionManager } from './compaction.js';
import { logConnectionEvent } from './supabase.js';
import { logSessionUsage } from './cost-tracking.js';
import { HandRaiseListener, publishPreparedVideo } from './room-interactions.js';

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

    // Hoisted so the same LLM instance can also drive context compaction
    // (Section 4.3) below, instead of spinning up a second one.
    const llm = openai.LLM.withGroq({ model: 'openai/gpt-oss-20b' });

    const session = new voice.AgentSession({
      // Direct Deepgram STT. Previously routed through LiveKit's inference gateway
      // because this network (a dev machine on a "small"/mobile connection) had
      // flaky routing specifically to Deepgram's WebSocket endpoint — confirmed via
      // repeated raw WebSocket tests at the time. The agent worker now runs on
      // Railway (2026-08-17), which has clean connectivity, so that workaround's
      // reason no longer applies here; TTS already reuses this same Deepgram
      // account/key successfully in production. If STT errors start showing up in
      // `railway logs`, that's the signal to revert to
      // `new inference.STT({ model: 'deepgram/nova-2', language: 'en' })`.
      stt: new deepgram.STT({ model: 'nova-2', language: 'en' }),
      // TEMPORARY (smoke test): OpenAI billing is blocked, so this runs on Groq's
      // free tier via the OpenAI plugin's built-in Groq adapter (same plugin, just a
      // different backend — no separate @livekit/agents-plugin-groq needed). Reads
      // GROQ_API_KEY from env. Swap back to `new openai.LLM({ model: 'gpt-4o-mini' })`
      // per Section 2 of the spec once OpenAI billing is sorted.
      //
      // gpt-oss-20b is a reasoning model — it spends tokens on hidden chain-of-thought
      // before the visible reply, so give it enough headroom or short answers get cut
      // off empty (confirmed: 10 tokens produced pure reasoning and no reply; 100 was
      // enough). Groq's available model lineup changes often — recheck against
      // https://api.groq.com/openai/v1/models if this 404s again later.
      llm,
      // TEMPORARY (cost): Cartesia's free tier (20K credits/month) was exhausted almost
      // immediately by real testing, and even the $5/mo Pro tier's 100K credits would
      // likely go the same way. Deepgram — already in use for STT — also does TTS
      // (Aura), confirmed working with real audio against the same account/key already
      // in .env, so this reuses an existing vendor relationship instead of adding a new
      // one. Swap back to `new cartesia.TTS({ model: 'sonic-3', voice: process.env.CARTESIA_VOICE_ID })`
      // (@livekit/agents-plugin-cartesia, still installed) if Cartesia's pricing becomes
      // worth it later — e.g. for voice cloning, which Deepgram's Aura voices don't do.
      tts: new deepgram.TTS({ model: 'aura-2-asteria-en' }),
      vad: await silero.VAD.load(),
      turnHandling: {
        interruption: { mode: 'vad', enabled: true }, // Section 4.2 — VAD interruption throttle
      },
    });

    const stateInjector = new StateInjector(session, learnerId); // Section 4.1 — shared focus
    const compaction = new CompactionManager(session, ctx.room.name ?? 'unknown-room', llm); // Section 4.3
    const handRaise = new HandRaiseListener(ctx.room, session); // live-class raise-hand
    const sessionStartedAt = Date.now(); // Section 5/6 — cost monitoring

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
      handRaise.dispose();
      void logSessionUsage(session, ctx.room.name ?? 'unknown-room', sessionStartedAt);
    });

    await session.start({
      agent: voice.Agent.create({ instructions: opening.systemPrompt }),
      room: ctx.room,
    });

    await ctx.connect();
    await logConnectionEvent(ctx.room.name ?? 'unknown-room', 'connected'); // Section 4.5

    if (opening.preparedVideo) publishPreparedVideo(ctx.room, opening.preparedVideo);

    await session.generateReply({ instructions: opening.openingLine });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'ai-tutor',
  }),
);
