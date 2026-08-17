-- Jua Institute — real program structure: weeks, mixed lesson types, quizzes.
-- Per the actual program design: 6 content weeks + week 7 as a live final
-- assessment, up to ~20 mixed-format lessons per week (video/reading/
-- case_study/quiz/puzzle), 2 live tutor sessions/week covering that week's
-- concepts.

create table course_weeks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade not null,
  week_number integer not null,
  title text not null,
  summary text not null,
  is_final_assessment boolean not null default false,
  live_sessions_per_week integer not null default 2,
  live_session_duration_minutes integer not null default 90,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (course_id, week_number)
);

alter table curriculum_nodes
  add column week_id uuid references course_weeks(id) on delete cascade,
  add column lesson_type text not null default 'reading'; -- 'reading' | 'video' | 'case_study' | 'quiz' | 'puzzle'

-- Structured quiz content — the admin dashboard needs to actually manage
-- quiz questions, not just markdown blobs, and the lesson page needs real
-- interactivity (pick an answer, get told if it's right) for lesson_type
-- 'quiz'.
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid references curriculum_nodes(id) on delete cascade not null,
  question text not null,
  options jsonb not null, -- array of option strings
  correct_index integer not null,
  explanation text,
  sequence_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_course_weeks_course on course_weeks(course_id, week_number);
create index idx_curriculum_nodes_week on curriculum_nodes(week_id, sequence_order);
create index idx_quiz_questions_node on quiz_questions(node_id, sequence_order);
