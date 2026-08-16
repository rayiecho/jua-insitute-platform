-- AI Tutor Platform — initial schema
-- Source of truth: platform-technical-specification-mvp.md, Section 3

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- 3.1 Identity & Voice
-- ─────────────────────────────────────────────

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

-- ─────────────────────────────────────────────
-- 3.2 Curriculum (program-agnostic)
-- ─────────────────────────────────────────────

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

-- ─────────────────────────────────────────────
-- 3.3 Live Sessions
-- ─────────────────────────────────────────────

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

-- ─────────────────────────────────────────────
-- 3.4 Session ↔ Curriculum link
-- ─────────────────────────────────────────────

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

-- ─────────────────────────────────────────────
-- 3.5 Long-term memory
-- ─────────────────────────────────────────────

create table lesson_memory_vectors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references platform_users(id) on delete cascade not null,
  session_id uuid references classroom_sessions(id) on delete set null,
  summary_text text not null,
  embedding vector(1536),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ─────────────────────────────────────────────
-- 3.6 Operational reliability
-- ─────────────────────────────────────────────

create table conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references classroom_sessions(id) on delete cascade not null,
  summary_text text not null,
  turn_range_start integer not null,
  turn_range_end integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table session_connection_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references classroom_sessions(id) on delete cascade not null,
  event_type text not null, -- 'connected' | 'dropped' | 'reconnected' | 'heartbeat'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ─────────────────────────────────────────────
-- Indexes for hot query paths (Section 4.4 continuity lookups)
-- ─────────────────────────────────────────────

create index idx_curriculum_nodes_course on curriculum_nodes(course_id, sequence_order);
create index idx_course_assignments_node on course_assignments(node_id);
create index idx_progress_user on student_assignments_progress(user_id);
create index idx_session_context_user on session_curriculum_context(user_id, created_at desc);
create index idx_memory_vectors_user on lesson_memory_vectors(user_id);
create index idx_conversation_summaries_session on conversation_summaries(session_id, turn_range_start);
create index idx_connection_events_session on session_connection_events(session_id, created_at desc);

-- ivfflat index for semantic memory retrieval — build after some data exists
-- (ivfflat needs representative data to choose good cluster centers)
-- create index idx_memory_vectors_embedding on lesson_memory_vectors
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);
