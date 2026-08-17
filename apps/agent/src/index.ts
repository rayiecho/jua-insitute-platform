import './env.js';

import { fileURLToPath } from 'node:url';
import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  inference,
  AgentSessionEventTypes,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as deepgram from '@livekit/agents-plugin-deepgram';
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
      // TEMPORARY (network diagnosis): this network has flaky routing specifically to
      // Deepgram's servers (confirmed via repeated raw WebSocket tests — reliable to
      // LiveKit and generic WSS endpoints, consistently fails to Deepgram directly).
      // Routing STT through LiveKit's own inference gateway means this machine only
      // ever talks to LiveKit (proven reliable); LiveKit Cloud calls Deepgram
      // server-side instead. Swap back to `new deepgram.STT({ model: 'nova-2',
      // language: 'en' })` (@livekit/agents-plugin-deepgram) if/when direct
      // connectivity to Deepgram stops being a problem.
      stt: new inference.STT({ model: 'deepgram/nova-2', language: 'en' }),
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
      llm: openai.LLM.withGroq({ model: 'openai/gpt-oss-20b' }),
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
