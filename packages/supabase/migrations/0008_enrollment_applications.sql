-- Jua Institute — decouple email verification from every learning action
-- except enrollment itself, and make live-class entry session-independent.
--
-- New flow: enrolling in a program collects a real application (name,
-- email, education level, weekly commitment, interests, policy agreement)
-- that's visible to admin immediately, then sends a one-time verification
-- link. Once verified, the learner never re-verifies. Live classes don't
-- use the browser session at all — the learner types first name + email
-- every time, and the tutor is resolved from that (see /api/livekit-token).

create table enrollment_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  course_id uuid references courses(id) on delete cascade not null,
  education_level text not null,
  commitment_hours text not null,
  interests text,
  policy_accepted_at timestamp with time zone not null default timezone('utc'::text, now()),
  status text not null default 'pending', -- 'pending' | 'verified'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_enrollment_applications_email on enrollment_applications(email);
create index idx_enrollment_applications_created on enrollment_applications(created_at desc);

alter table platform_users
  add column email_verified boolean not null default false,
  add column education_level text,
  add column commitment_hours text,
  add column interests text;
