-- Jua Institute — enrollment tracking.
-- Section 4.4 continuity previously guessed at "the first course" with no
-- concept of which program a learner actually chose. This makes enrollment
-- explicit (set when a learner starts a program) and tracks the last lesson
-- they viewed within it, so the tutor coaches on the right program and picks
-- up from the right lesson.

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references platform_users(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  last_viewed_node_id uuid references curriculum_nodes(id),
  enrolled_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_viewed_at timestamp with time zone,
  unique (user_id, course_id)
);

create index idx_enrollments_user on enrollments(user_id, last_viewed_at desc nulls last);
