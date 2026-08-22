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
import { RoomServiceClient } from 'livekit-server-sdk';

import { buildOpeningContext, buildGroupOpeningContext } from './continuity.js';
import { StateInjector } from './state-injection.js';
import { CompactionManager } from './compaction.js';
import { logConnectionEvent } from './supabase.js';
import { logSessionUsage } from './cost-tracking.js';
import { HandRaiseListener, publishPreparedVideo } from './room-interactions.js';
import { createTeachingScreenTools } from './teaching-screen.js';
import { ChatListener } from './chat-listener.js';
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

// The endClass tool was firing after just a few minutes on ordinary
// conversation (confirmed live 2026-08-18/19 via Railway logs — the model
// judged a learner explaining the new camera feature to someone nearby as
// "disengaged"). A hard floor makes that class of over-eager call
// structurally impossible for the first chunk of every session, regardless
// of how the model reads the conversation.
const MIN_MINUTES_BEFORE_END_CLASS = 10;

// Section 4.1 / 4.2 / 4.3 of platform-technical-specification-mvp.md drive the
// shape of this worker. Each numbered section below maps to one behavior
// requirement from the spec — keep the mapping when this file grows.

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // Dispatch metadata is JSON now (see apps/web/src/app/api/livekit-token/
    // route.ts). Scheduled cohort classes send { classSessionId } — several
    // learners share one room and the tutor teaches the group. The older
    // { learnerId, courseId } shape (and a bare-string fallback) is kept for
    // robustness against any dispatch path that hasn't moved to the group
    // model.
    let learnerId = 'unknown-learner';
    let courseId: string | undefined;
    let classSessionId: string | undefined;
    try {
      const parsed = JSON.parse(ctx.job.metadata || '{}');
      if (parsed && typeof parsed === 'object' && parsed.classSessionId) {
        classSessionId = parsed.classSessionId;
      } else if (parsed && typeof parsed === 'object' && parsed.learnerId) {
        learnerId = parsed.learnerId;
        courseId = parsed.courseId ?? undefined;
      } else {
        learnerId = ctx.job.metadata || 'unknown-learner';
      }
    } catch {
      learnerId = ctx.job.metadata || 'unknown-learner';
    }

    const isGroupClass = Boolean(classSessionId);
    const opening = isGroupClass
      ? await buildGroupOpeningContext(classSessionId!)
      : await buildOpeningContext(learnerId, courseId); // Section 4.4

    // Hoisted so the same LLM instance can also drive context compaction
    // (Section 4.3) below, instead of spinning up a second one.
    const groqLlm = openai.LLM.withGroq({ model: 'openai/gpt-oss-20b' });
    const sessionStartedAt = Date.now(); // Section 5/6 — cost monitoring; also gates endClassTool below

    // Ends the class for BOTH sides. ctx.room.disconnect() only removes the
    // agent's own participant — confirmed live 2026-08-18/19 that the
    // learner's connection is untouched by it, so their client just sits in
    // a now-empty room with no agent and no signal to leave, showing
    // "waiting to connect" forever (exactly the bug reported). The learner
    // has to be explicitly removed server-side so their client gets a real
    // Disconnected event and actually returns to the lobby.
    async function endSession() {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const serverUrl = process.env.LIVEKIT_URL;
      if (apiKey && apiSecret && serverUrl && ctx.room.name) {
        const rsc = new RoomServiceClient(serverUrl, apiKey, apiSecret);
        if (isGroupClass) {
          // A cohort class can have several learners in the room — remove
          // everyone except the agent's own participant, not just one identity.
          const ownIdentity = ctx.room.localParticipant?.identity;
          const participants = await rsc.listParticipants(ctx.room.name).catch(() => []);
          await Promise.all(
            participants
              .filter((p) => p.identity !== ownIdentity)
              .map((p) =>
                rsc.removeParticipant(ctx.room.name!, p.identity).catch((err) => {
                  console.error('[endSession] failed to remove participant', p.identity, err);
                }),
              ),
          );
        } else {
          await rsc.removeParticipant(ctx.room.name, learnerId).catch((err) => {
            console.error('[endSession] failed to remove learner participant:', err);
          });
        }
      }
      await ctx.room.disconnect();
    }

    // The tutor's own way to end a class early — the spec calls for this
    // explicitly ("if it sees the learner is not focused, they just end the
    // class"). True visual disengagement detection needs the vision work
    // that hasn't landed yet; until then this gives the tutor a real,
    // usable exit when the learner is clearly checked out. Confirmed live
    // 2026-08-18/19 that the model called this after only a few minutes on
    // ordinary conversation (a learner explaining the new camera feature to
    // someone nearby) — the description below is deliberately stricter, and
    // MIN_MINUTES_BEFORE_END_CLASS blocks it structurally regardless of
    // what the model decides.
    const endClassTool = llm.tool({
      description:
        "End the live class now. This is a LAST RESORT, not a normal way to wrap up — only use it if the learner has been unresponsive or clearly checked out for several minutes DESPITE you actively checking in more than once, or they explicitly ask to end the session. Talking about the platform, the camera, being tested, or anything off-topic is NOT disengagement — that's still an active, present learner. When in doubt, do not call this tool; keep teaching instead.",
      execute: async () => {
        const minutesElapsed = (Date.now() - sessionStartedAt) / 60000;
        if (minutesElapsed < MIN_MINUTES_BEFORE_END_CLASS) {
          return `Too early to end the class (only ${minutesElapsed.toFixed(1)} minutes in) — keep teaching instead.`;
        }
        setTimeout(() => void endSession(), 1500); // let the closing line finish playing
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
      // Male voice (Deepgram's real, current Aura-2 catalog, verified 2026-08-18)
      // to match the male avatar face — "asteria" was a female voice, a
      // mismatch confirmed live once the avatar's face became visible.
      tts: new deepgram.TTS({ model: 'aura-2-orpheus-en' }),
      vad: await silero.VAD.load(),
      turnHandling: {
        interruption: { mode: 'vad', enabled: true }, // Section 4.2 — VAD interruption throttle
      },
    });

    // Shared-focus code-state injection assumes one learner's editor state
    // maps onto the session — that doesn't hold for a group class with
    // several learners each possibly looking at different things, so it's
    // simply not wired up for classSessionId-based dispatch.
    const stateInjector = isGroupClass ? null : new StateInjector(session, learnerId); // Section 4.1 — shared focus
    const compaction = new CompactionManager(session, ctx.room.name ?? 'unknown-room', groqLlm); // Section 4.3
    const handRaise = new HandRaiseListener(ctx.room, session); // live-class raise-hand
    const chatListener = new ChatListener(ctx.room, session); // live-class typed chat
    let classTimers: ReturnType<typeof setTimeout>[] = [];

    // Section 4.2 — interruption must be a server-side event, not client-triggered, so it
    // survives mobile network jitter. AgentSession's own VAD-mode interruption (configured
    // above) already cancels in-flight LLM/TTS generation server-side; this handler is the
    // hook point for additional server-side cleanup if that turns out to be insufficient
    // once real mobile testing starts, and also drives the shared-focus flush (Section 4.1).
    session.on(AgentSessionEventTypes.UserStateChanged, (ev) => {
      if (ev.newState === 'speaking') stateInjector?.flushOnSpeechStart();
    });
    session.on(AgentSessionEventTypes.Close, () => {
      stateInjector?.dispose();
      compaction.dispose();
      handRaise.dispose();
      chatListener.dispose();
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

    const { showCode, showSlide } = createTeachingScreenTools(ctx.room);
    // Confirmed live 2026-08-19: with showCode available in every course,
    // the tutor wrote a Python pandas demo mid-Entrepreneurship-class as an
    // "illustration" of a data concept — the tool being merely described as
    // Python-only wasn't enough to stop it reaching for it. There's no
    // course category column in the schema (courses only has title/
    // description/difficulty_level), so this is a title heuristic; revisit
    // if a real "track" column gets added later.
    const isProgrammingCourse = /python|program|coding|software|developer/i.test(opening.courseTitle ?? '');

    await session.start({
      agent: voice.Agent.create({
        instructions: opening.systemPrompt,
        tools: isProgrammingCourse
          ? { endClass: endClassTool, showCode, showSlide }
          : { endClass: endClassTool, showSlide },
      }),
      room: ctx.room,
      // RoomIO's default (closeOnDisconnect: true) tears down the whole
      // agent session the moment the ONE participant it's linked to
      // disconnects — built for 1-on-1. Confirmed live 2026-08-19 via a
      // real two-learner Entrepreneurship class: a learner joining ~7
      // minutes after the first (a genuinely ordinary "joined late", not a
      // disconnect) landed on a freshly restarted session that re-ran the
      // opening welcome from scratch instead of continuing — the first
      // learner's brief connection hiccup around then closed the session,
      // and the next join re-triggered a whole new job. For a scheduled
      // class with several learners coming and going, the class itself
      // should keep running until the hard time cap (or endClassTool),
      // never collapse just because whichever participant it happened to
      // link to first drops out.
      inputOptions: isGroupClass ? { closeOnDisconnect: false } : undefined,
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
        void endSession();
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
