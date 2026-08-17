# AI Tutor Platform

Monorepo for the platform described in
[`platform-technical-specification-mvp.md`](platform-technical-specification-mvp.md).
That document is the source of truth for architecture, schema, and behavior
requirements — this README only covers how the pieces here map to it and how
to run them.

## Layout

```
apps/
  web/      Next.js client — self-paced lesson UI + live session UI + API routes
  mobile/   Expo client — lesson UI (no live session UI yet)
  agent/    LiveKit agent worker — the tutor's brain (STT/LLM/TTS loop,
            VAD interruption throttle, shared-focus injection, compaction)
packages/
  supabase/ Schema migrations (Section 3 of the spec)
scripts/
  seed/     Source content for the one demo lesson seeded into Supabase
```

`apps/mobile` is intentionally outside the npm workspace — Expo/React Native
dependency resolution is happier managed on its own; run its npm commands
from inside `apps/mobile` directly.

## MVP scope

Per Section 1 of the spec: one program, 1-on-1 tutoring only, no avatar
(voice + waveform), full self-paced platform + grading pipeline. Build order
follows Section 5's five phases.

## Setup

```bash
# 1. Supabase project — run packages/supabase/migrations/0001_init.sql
#    in the SQL Editor (no CLI login available in this dev setup, see
#    packages/supabase/README.md)

# 2. Env files — copy and fill in each app's .env.example
cp apps/web/.env.example apps/web/.env.local
cp apps/agent/.env.example apps/agent/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# 3. Install
npm install                      # installs web + agent workspaces
cd apps/mobile && npm install    # mobile separately

# 4. Run
npm run dev:web                  # Next.js dev server
npm run dev:agent                # LiveKit agent worker (registers with LiveKit Cloud)
cd apps/mobile && npm start      # then scan the QR with Expo Go — see apps/mobile/README.md
```

## What's built and live-tested

**Phase 1 — live tutoring loop.** The agent worker joins a LiveKit room on
dispatch, runs STT → LLM → TTS with VAD-based interruption, and the web
client (`/session/[room]`) shows a reactive waveform and plays real audio.
Confirmed working end-to-end against real credentials, including the full
turn cycle (transcription → reply → audible speech).

**Phase 2 — self-paced lesson + code sandbox.** One real lesson is seeded
(`/learn/variables-and-types` on web, same content on mobile): markdown
content, a Monaco editor (web) / native text editor (mobile, per Section 2),
both synced to `student_assignments_progress.current_code_state` on a
debounce, which the agent's shared-focus injection (Section 4.1) reads from.
Session continuity (Section 4.4) is wired to this real data — joining a
session links `session_curriculum_context` to the learner's actual
in-progress lesson, and the tutor's opening line reflects it.

**Phase 3 — grading (Section 4.6).** `/api/grade` runs the cost-gated flow:
sandbox-execute first, always; a syntax/exec-time error returns instantly
with zero LLM calls; anything that actually runs (pass or fail) gets bundled
to an LLM for scored feedback. Live-tested with real syntax-error, failing,
and passing submissions.

No real auth yet (Section 1 scope) — `LearnerGate` / mobile's login screen
get-or-create a `platform_users` row by email as a stand-in identity.

## Known temporary substitutions

Documented inline at each call site, listed here so they're easy to find and
revert:

- **LLM (tutoring):** Groq (`openai/gpt-oss-20b`) instead of OpenAI
  `gpt-4o-mini` — OpenAI billing is blocked. `apps/agent/src/index.ts`.
- **LLM (grading):** Groq instead of Claude — no `ANTHROPIC_API_KEY` yet.
  `apps/web/src/app/api/grade/route.ts`.
- **STT:** LiveKit's `inference.STT` gateway instead of calling Deepgram
  directly — this dev network has unreliable routing specifically to
  Deepgram's servers (confirmed via direct WebSocket tests). Routing through
  LiveKit means this machine only needs to reach LiveKit, which is reliable.
  `apps/agent/src/index.ts`.
- **Code sandbox:** Wandbox (public, no-signup execution service) instead of
  a self-hosted Docker sandbox / Supabase Edge Function — no Docker available
  in this environment and Edge Function deployment needs interactive CLI
  login we don't have. `apps/web/src/lib/sandbox.ts`.
- **DB access pattern:** Supabase's RLS is enabled on this project with no
  policies defined (discovered, not assumed — the anon key silently returned
  nothing). All reads/writes go through the service-role admin client from
  trusted server-side code instead. See `packages/supabase/README.md`.

## Not built yet

- Cohort classes, multiple programs, payment tiering — explicitly out of MVP
  scope (Section 1).
- Mobile live tutoring session UI (LiveKit) — only the lesson/sandbox screen
  has mobile parity so far.
- Context compaction's actual history condensation (`apps/agent/src/compaction.ts`
  has the trigger logic but summarizes to a placeholder string, not a real
  LLM-condensed summary yet).
- `lesson_memory_vectors` embedding + semantic retrieval (Phase 4) — the
  continuity query reads most-recent-N rows as a placeholder.
- RLS policies — currently bypassed everywhere via the service-role client,
  fine while there's no real auth, but needs real policies once there is.
