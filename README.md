# AI Tutor Platform

Monorepo scaffold for the platform described in
[`platform-technical-specification-mvp.md`](platform-technical-specification-mvp.md).
That document is the source of truth for architecture, schema, and behavior
requirements — this README only covers how the pieces here map to it and how
to run them.

## Layout

```
apps/
  web/      Next.js client (self-paced platform + live session UI)
  mobile/   Expo client (same features, cross-platform)
  agent/    LiveKit agent worker — the tutor's brain (STT/LLM/TTS loop,
            VAD interruption throttle, shared-focus injection, compaction)
packages/
  supabase/ Schema migrations (Section 3 of the spec), applied via Supabase CLI
```

`apps/mobile` is intentionally outside the npm workspace — Expo/React Native
dependency resolution is happier managed on its own; run its npm commands
from inside `apps/mobile` directly.

## MVP scope

Per Section 1 of the spec: one program, 1-on-1 tutoring only, no avatar
(voice + waveform), full self-paced platform + grading pipeline. Build order
follows Section 5's five phases — check that section before picking up new
work so effort lands in the right phase.

## Setup

```bash
# 1. Supabase project (hosted or local via `supabase start`)
cd packages/supabase && supabase link --project-ref <ref> && supabase db push

# 2. Env files — copy and fill in each app's .env.example
cp apps/web/.env.example apps/web/.env.local
cp apps/agent/.env.example apps/agent/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local   # once mobile needs its own

# 3. Install
npm install                      # installs web + agent workspaces
cd apps/mobile && npm install    # mobile separately

# 4. Run
npm run dev:web                  # Next.js dev server
npm run dev:agent                # LiveKit agent worker (registers with LiveKit Cloud)
cd apps/mobile && npm run ios    # or android / web
```

## What's real vs. scaffolded

The agent worker (`apps/agent/src/`) wires up the actual LiveKit Agents SDK
with Deepgram/OpenAI/Cartesia/Silero plugins per the spec's stack table, and
the control flow follows Sections 4.1–4.5 (state injection debounce, VAD
interruption mode, compaction trigger, continuity queries, connection event
logging). Several `TODO` markers remain where the exact `@livekit/agents`
API needs verifying against the installed version once real credentials and
a real room are available to test against — search the codebase for `TODO`
before treating Phase 1 as done.

The Supabase schema (`packages/supabase/migrations/0001_init.sql`) is a
direct, complete translation of Section 3 — no placeholders there.

The web and mobile clients are stock scaffolds (Next.js App Router + Tailwind,
Expo blank-typescript) with a Supabase client wired into the web app. UI,
Monaco/code-sandbox integration, and the LiveKit room components are not yet
built — that's the next slice of Phase 1/2 work.
