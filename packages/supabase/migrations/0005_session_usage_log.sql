-- Jua Institute — Section 5 Phase 5 / Section 6 cost monitoring.
-- Nothing tracked per-session cost anywhere before this. One row per
-- (session, usage type) at session close — usage type is 'agent_session'
-- (LiveKit's flat per-minute agent fee), 'llm', 'tts', or 'stt'.

create table session_usage_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references classroom_sessions(id) on delete cascade not null,
  usage_type text not null, -- 'agent_session' | 'llm' | 'tts' | 'stt'
  provider text not null,
  model text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  characters_count integer default 0,
  audio_duration_ms integer default 0,
  estimated_cost_usd numeric(10, 5) default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_session_usage_log_session on session_usage_log(session_id);
create index idx_session_usage_log_created on session_usage_log(created_at desc);
