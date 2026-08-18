-- Jua Institute — live classes reduced to 45 minutes each.
-- Simli (the avatar vendor) is only affordable at up to 2 concurrent
-- sessions on the current plan, so shorter sessions let more learners get a
-- slot per day. apps/agent/src/index.ts enforces the actual 45-minute cap at
-- runtime — this just keeps the schema's stated duration honest for admin
-- views and the session guide.

update course_weeks set live_session_duration_minutes = 45;
alter table course_weeks alter column live_session_duration_minutes set default 45;
