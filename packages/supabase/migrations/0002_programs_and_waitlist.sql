-- Jua Institute — multi-program catalog support.
-- courses/curriculum_nodes/course_assignments were already program-agnostic
-- (Section 3.2 of the spec); this adds what's needed to list several
-- programs with different launch states, plus a waitlist for not-yet-live ones.

alter table courses
  add column status text not null default 'live', -- 'live' | 'coming_soon'
  add column slug text unique,
  add column tagline text;

alter table curriculum_nodes
  add column video_url text; -- seeded YouTube video for the lesson, optional

create table waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  course_id uuid references courses(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (email, course_id)
);
