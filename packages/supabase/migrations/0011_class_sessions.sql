-- Jua Institute — scheduled cohort live classes, replacing the "join
-- anytime, 1-on-1" model with real scheduled sessions multiple learners
-- join together. Room name is deliberately NOT stored — it's always
-- derived as `class-${id}` in application code, so there's nothing to keep
-- in sync.

create table class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  week_id uuid references course_weeks(id) on delete set null,
  scheduled_start timestamp with time zone not null,
  duration_minutes integer not null default 45,
  status text not null default 'scheduled', -- 'scheduled' | 'completed' | 'cancelled'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table class_session_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid references class_sessions(id) on delete cascade not null,
  user_id uuid references platform_users(id) on delete cascade not null,
  joined_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (class_session_id, user_id)
);

create index idx_class_sessions_course on class_sessions(course_id, scheduled_start);
create index idx_class_session_enrollments_user on class_session_enrollments(user_id, class_session_id);
create index idx_class_session_enrollments_session on class_session_enrollments(class_session_id);
