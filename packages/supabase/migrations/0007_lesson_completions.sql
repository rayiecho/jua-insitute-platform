-- Jua Institute — lesson completion tracking, the foundation for Canvas-style
-- completion checkmarks and sequential unlocking (can't skip ahead until the
-- prior lesson is done).

create table lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references platform_users(id) on delete cascade not null,
  node_id uuid references curriculum_nodes(id) on delete cascade not null,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, node_id)
);

create index idx_lesson_completions_user on lesson_completions(user_id);
