import './env.js';

import { fileURLToPath } from 'node:url';
import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  llm,
  AgentSessionEventTypes,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';
import { TrackPublishOptions, TrackSource } from '@livekit/rtc-node';

import { buildOpeningContext } from './continuity.js';
import { StateInjector } from './state-injection.js';
import { CompactionManager } from './compaction.js';
import { logConnectionEvent } from './supabase.js';
import { logSessionUsage } from './cost-tracking.js';
import { HandRaiseListener, publishPreparedVideo } from './room-interactions.js';
import { SimliAvatarSession } from './simli-avatar.js';

// Live classes are capped at 45 minutes — deliberately shorter than
// course_weeks.live_session_duration_minutes' original 90, because Simli
// (the avatar vendor) is only affordable at a max of 2 concurrent sessions
// on the current plan, so shorter sessions let more learners actually get a
// slot per day. Enforced twice: as Simli's own maxSessionLength (kills the
// avatar) and as a hard room-level timer below (ends the whole class, not
// just the video) in case those ever drift apart.
const CLASS_DURATION_MINUTES = 45;
const CLASS_DURATION_MS = CLASS_DURATION_MINUTES * 60 * 1000;
const WIND_DOWN_WARNING_MS = CLASS_DURATION_MS - 3 * 60 * 1000; // 3 min before the end

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
    const groqLlm = openai.LLM.withGroq({ model: 'openai/gpt-oss-20b' });

    // The tutor's own way to end a class early — the spec calls for this
    // explicitly ("if it sees the learner is not focused, they just end the
    // class"). True visual disengagement detection needs the vision work
    // that hasn't landed yet; until then this gives the tutor a real,
    // usable exit when the learner is clearly checked out (repeated
    // non-answers, explicitly asking to stop, going quiet for a long
    // stretch), rather than being stuck narrating to no one.
    const endClassTool = llm.tool({
      description:
        "End the live class now. Use this only if the learner is clearly disengaged (repeatedly not responding, explicitly asking to end, or has been silent for a long stretch despite you checking in) — not just because the material is hard or they're thinking.",
      execute: async () => {
        setTimeout(() => void ctx.room.disconnect(), 1500); // let the closing line finish playing
        return 'Ending the class now.';
      },
    });

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
      llm: groqLlm,
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
    const compaction = new CompactionManager(session, ctx.room.name ?? 'unknown-room', groqLlm); // Section 4.3
    const handRaise = new HandRaiseListener(ctx.room, session); // live-class raise-hand
    const sessionStartedAt = Date.now(); // Section 5/6 — cost monitoring
    let classTimers: ReturnType<typeof setTimeout>[] = [];

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
      classTimers.forEach(clearTimeout);
      void logSessionUsage(session, ctx.room.name ?? 'unknown-room', sessionStartedAt);
    });

    // Real avatar (Simli) — see simli-avatar.ts for why this is a hand-port
    // of Simli's Python plugin rather than an official Node package (none
    // exists). SIMLI_FACE_ID picks which face renders; capped at
    // CLASS_DURATION_MINUTES so Simli's own session timer matches the
    // room-level one below rather than cutting the avatar off mid-class at
    // its 10-minute default.
    //
    // avatar.start() itself only confirms Simli's API *accepted* the join
    // request (confirmed live: it returns 200 "Agent Successfully Joined"
    // immediately) — it does NOT confirm Simli's avatar actually finished
    // connecting and publishing video. Confirmed live 2026-08-18: a real
    // class hung indefinitely on "Thinking…" with no avatar and no audio,
    // because output.audio was already pointed at the avatar's
    // DataStreamAudioOutput (see simli-avatar.ts) and nothing was ever on
    // the other end to receive and relay it back into the room — every
    // spoken reply vanished into a dead end instead of falling back to
    // normal voice. waitForJoin() is the only way to actually confirm the
    // avatar is live; on timeout, output.audio is rebuilt as a normal
    // direct-publish output (the exact defaults RoomIO itself uses — see
    // node_modules/@livekit/agents/dist/voice/room_io/room_io.js) so the
    // class degrades to voice-only instead of going silent.
    const simliFaceId = process.env.SIMLI_FACE_ID;
    if (simliFaceId) {
      const avatar = new SimliAvatarSession({
        faceId: simliFaceId,
        maxSessionLengthSeconds: CLASS_DURATION_MINUTES * 60,
      });
      try {
        await avatar.start(session, ctx.room);
        await avatar.waitForJoin({ timeout: 15000 });
        console.log('[simli] avatar joined and publishing');
      } catch (err) {
        console.error('[simli] avatar failed to join in time, falling back to voice-only:', err);
        session.output.audio = new voice.ParticipantAudioOutput(ctx.room, {
          sampleRate: 24000,
          numChannels: 1,
          trackPublishOptions: new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
        });
      }
    }

    await session.start({
      agent: voice.Agent.create({ instructions: opening.systemPrompt, tools: { endClass: endClassTool } }),
      room: ctx.room,
    });

    await ctx.connect();
    await logConnectionEvent(ctx.room.name ?? 'unknown-room', 'connected'); // Section 4.5

    // Hard cap independent of Simli's own timer (see CLASS_DURATION_MS
    // comment above) — ends the whole class, not just the avatar's video,
    // so a drift between the two never leaves a voice-only tutor talking
    // into a frozen frame.
    classTimers = [
      setTimeout(() => {
        void session.generateReply({
          instructions:
            "Let the learner know, briefly, that this session is wrapping up in about 3 minutes — don't cut off what you're doing abruptly, just work toward a natural stopping point.",
        });
      }, WIND_DOWN_WARNING_MS),
      setTimeout(() => {
        void ctx.room.disconnect();
      }, CLASS_DURATION_MS),
    ];

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
