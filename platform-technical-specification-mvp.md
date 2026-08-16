# AI TUTOR PLATFORM — TECHNICAL SPECIFICATION
### For the Development Team — MVP Build Document

---

## 1. What We're Building (Read This First)

A learning platform with two integrated halves, working as one product:

1. **The Learning Platform** — self-paced curriculum (notes, videos, case studies, assignments, automated grading), structured as a dependency graph per program. Program-agnostic: works for Python, UI/UX, business, languages — anything.
2. **The Live Class Layer** — an AI tutor that teaches the same curriculum live, either 1-on-1 (scheduled, per-learner, remembers them across sessions) or in cohorts (up to 20 learners, one tutor).

**The two are not separate products.** A live class always teaches *from* what's already on the platform. A self-paced learner can jump into a live class anytime and the tutor already knows where they are.

**MVP scope — build this first, nothing more:**
- One program only (pick the one with the most complete content ready)
- 1-on-1 live tutoring only (no cohort classes yet)
- No 3D avatar — voice + reactive waveform graphic only
- Full self-paced platform + grading pipeline

Everything else in this document beyond that scope is documented so the architecture doesn't have to be rebuilt later — but it is **not** MVP work.

---

## 2. System Architecture

```
[ Web Client: Next.js ] ────┐                             ───> [ Deepgram ] (Speech-to-Text)
                             ├─> [ LiveKit WebRTC SFU ] ───┼──> [ LLM: GPT-4o-mini / Claude ] (Brain)
[ Mobile Client: Expo ] ─────┘                             ───> [ Cartesia.ai ] (Voice Output)
       │                                                               ▲
(Shared Code/State Updates)                                            │
       ▼                                                               │
[ Supabase Backend ] ───────────────────────────────────────────────────┘
 ├── Realtime WebSockets (live session state, live code sync)
 ├── pgvector (long-term learner memory embeddings)
 ├── PostgreSQL (users, curriculum, progress, grading)
 └── Edge Functions (sandboxed test execution)
```

**Core stack:**
| Layer | Tool | Purpose |
|---|---|---|
| Backend / DB | Supabase | Auth, realtime sync, relational data, vector memory |
| Realtime media | LiveKit Cloud | Voice routing, WebRTC, agent worker hosting |
| Speech-to-text | Deepgram (Nova-2) | Streaming transcription, detects interruptions |
| Voice output | Cartesia.ai | Cloned voice, low-latency TTS |
| Reasoning | GPT-4o-mini (chat) / Claude (grading & deep feedback) | Split by cost/complexity |
| Mobile | Expo + EAS | Cross-platform build/delivery |
| Code sandbox | Monaco (web) / native text component (mobile) | Live editable workspace |
| Grading execution | Supabase Edge Function + Docker sandbox | Isolated, secure test runs |

---

## 3. Database Schema (Complete, Merged)

### 3.1 Identity & Voice

```sql
create extension if not exists vector;

create table voice_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_provider text not null default 'cartesia',
  voice_id_token text not null,
  accent text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table platform_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text not null,
  last_name text not null,
  preferred_voice_id uuid references voice_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 3.2 Curriculum (Program-Agnostic)

```sql
create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  difficulty_level text not null default 'Beginner',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table curriculum_nodes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  title text not null,
  slug text not null unique,
  sequence_order integer not null,
  markdown_content text not null,
  prerequisite_node_id uuid references curriculum_nodes(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table course_assignments (
  id uuid primary key default gen_random_uuid(),
  node_id uuid references curriculum_nodes(id) on delete cascade not null,
  title text not null,
  instructions_markdown text not null,
  starter_code text,
  unit_test_suite_code text,
  max_score integer default 100 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table student_assignments_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references platform_users(id) on delete cascade not null,
  assignment_id uuid references course_assignments(id) on delete cascade not null,
  current_code_state text,
  grading_status text default 'in_progress',
  score_achieved integer,
  ai_feedback_report text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, assignment_id)
);
```

### 3.3 Live Sessions

```sql
create table classroom_sessions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null unique,
  max_students integer default 1,
  current_status text default 'pending',
  current_lesson_state text,
  active_voice_id uuid references voice_profiles(id) not null,
  scheduled_start timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table classroom_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references classroom_sessions(id) on delete cascade not null,
  user_id uuid references platform_users(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (session_id, user_id)
);
```

### 3.4 The Missing Link — Session ↔ Curriculum

*Without this table, the live layer and the learning platform don't know about each other.*

```sql
create table session_curriculum_context (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references classroom_sessions(id) on delete cascade not null,
  user_id uuid references platform_users(id) on delete cascade not null,
  active_node_id uuid references curriculum_nodes(id) not null,
  active_assignment_id uuid references course_assignments(id),
  session_summary text,
  next_recommended_node_id uuid references curriculum_nodes(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 3.5 Long-Term Memory

```sql
create table lesson_memory_vectors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references platform_users(id) on delete cascade not null,
  session_id uuid references classroom_sessions(id) on delete set null,
  summary_text text not null,
  embedding vector(1536),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 3.6 Operational Reliability (Live Session Support)

```sql
-- Rolling conversation compaction — prevents token cost blowing up mid-session
create table conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references classroom_sessions(id) on delete cascade not null,
  summary_text text not null,
  turn_range_start integer not null,
  turn_range_end integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Connection health tracking — mobile connections drop; this prevents stuck session locks
create table session_connection_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references classroom_sessions(id) on delete cascade not null,
  event_type text not null, -- 'connected' | 'dropped' | 'reconnected' | 'heartbeat'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

---

## 4. The Tutor Engine — Behavior Requirements

### 4.1 Shared Focus (not "vision" — live state injection)

The tutor must react to the learner's live work without being asked. This is text/state streaming, not image/vision processing.

- Learner's code (or design file state, essay draft, etc., depending on program) updates in Supabase in real time as they work.
- On each learner utterance, the current state of `current_code_state` is injected into the LLM prompt automatically: `[Current Student State: ...]`.
- **Trigger discipline:** do not inject on every keystroke. Debounce — inject on pause-in-typing (~1.5–2s of inactivity) or at the moment the learner starts speaking. Constant injection wastes tokens and adds jitter.

### 4.2 Interruption Handling (VAD Throttle)

- The moment Deepgram's voice activity detection fires on the learner speaking, the server must immediately:
  1. Cancel the in-flight LLM streaming response.
  2. Issue a server-side `track.mute()` / buffer-clear via the LiveKit Agent API — do not rely on client-side muting alone; it's less reliable and wastes TTS generation cost.
- This must be a server-side event, not a client-triggered one, so it works even under mobile network jitter.

### 4.3 Context Compaction

- Do not pass full raw conversation history into the LLM every turn.
- Trigger compaction by **token count**, not fixed turn count (turns vary wildly in length). Suggested threshold: compact when the active buffer exceeds ~3,000 tokens.
- On trigger: background worker condenses history into a bullet summary, writes to `conversation_summaries`, clears the active in-context buffer.

### 4.4 Session Continuity ("Pick Up Where We Left Off")

At session start, before the tutor speaks:
1. Query `student_assignments_progress` for the learner's current state.
2. Query the most recent `session_curriculum_context.session_summary` for this learner.
3. Query `lesson_memory_vectors` for relevant long-term context (semantic search against the current node).
4. Inject all three into the tutor's opening context so the first thing it says reflects continuity, not a cold start.

### 4.5 Mobile Connection Reliability

- iOS and Android aggressively kill backgrounded WebSocket/WebRTC connections when the screen dims or the app is switched.
- A screen-awake WakeLock is necessary but **not sufficient on iOS** — iOS kills background connections independent of screen state. The mobile dev must implement a background audio session mode (or CallKit-style "active call" declaration) so the OS treats the session as an ongoing call, not backgroundable idle activity. Confirm current Expo/EAS background execution support before assuming WakeLock alone solves this.
- Every disconnect/reconnect must log to `session_connection_events` so sessions don't leave stuck locks in `classroom_sessions.current_status`.

### 4.6 Cost-Gated Grading (Do Not Skip This — It's the Margin Protector)

When a learner submits an assignment:
1. Compile/run the code in the Docker sandbox first, always.
2. If it fails on **syntax** — return the raw terminal error instantly. **Never call the LLM for this.**
3. If it compiles but fails **business logic tests**, or passes but warrants a quality review — bundle code + test results + errors and send to Claude for a full audit and feedback.
4. Only step 3 costs real AI tokens. This is the difference between a sustainable per-user cost and an unsustainable one — do not let this gate get bypassed for convenience during development.

---

## 5. MVP Build Sequence

**Phase 1 — Core 1-on-1 Live Loop (Weeks 1–4)**
- LiveKit room setup, Next.js + Expo clients
- Deepgram streaming STT integration
- LLM conversational loop (GPT-4o-mini)
- Cartesia voice output
- VAD interruption throttle (server-side)
- Simple reactive waveform UI — no avatar

**Phase 2 — Shared Focus + Curriculum Link (Weeks 3–6, overlaps Phase 1)**
- Curriculum tables populated for one program
- Code sandbox (Monaco web / native mobile) with realtime sync to Supabase
- Live state injection into tutor prompt (debounced)
- `session_curriculum_context` wiring — continuity logic (Section 4.4)

**Phase 3 — Grading Pipeline (Weeks 5–8, overlaps Phase 2)**
- Docker sandbox test execution via Edge Function
- Cost-gated grading logic (Section 4.6)
- `student_assignments_progress` updates, mastery unlocking

**Phase 4 — Reliability & Memory (Weeks 7–9)**
- Context compaction worker
- `lesson_memory_vectors` embedding + retrieval
- Mobile keep-alive / background session handling
- Connection event logging + session recovery

**Phase 5 — Polish & Test (Weeks 9–12)**
- End-to-end learner testing with real content
- Cost monitoring dashboards (token spend, per-session cost vs. the $0.60/hr target)
- Bug fixing, latency tuning

**Explicitly NOT in MVP** (documented for later, not built now):
- 3D avatar / lip-sync / gesture animation
- Cohort classes (up to 20 learners)
- Multiple programs simultaneously
- Payment tiering / metered billing logic

---

## 6. Cost Targets (What "Working Well" Means Financially)

| Item | Target |
|---|---|
| Live tutoring cost | ~$0.60–0.65 per learner-hour |
| Self-paced platform cost | Near-zero per learner-hour (hosting only) |
| Grading cost | Only incurred on real logic errors, not syntax |
| Token bloat | Must stay flat across a full 1-hour session (compaction working) |

If per-session actual cost drifts meaningfully above these targets during Phase 5 testing, the compaction or grading-gate logic has a bug — treat that as a release blocker, not a later optimization.

---

## 7. Open Engineering Decisions (Flag to Team Before Building)

- Confirm current Cartesia pricing before final cost lock-in (vendor pricing changes).
- Confirm iOS background session strategy with Expo/EAS docs directly — do not assume WakeLock is sufficient.
- Decide debounce timing for live state injection (start at ~1.5–2s, tune from real usage).
- Decide token threshold for context compaction (start at ~3,000 tokens, tune from real usage).
