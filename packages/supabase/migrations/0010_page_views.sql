-- Jua Institute — real visit tracking, starting from when this migration
-- runs. There's no historical data before this — nothing existed to track
-- earlier visits, so any question about traffic before this table existed
-- has no real answer; this only ever reports what actually happened after.

create table page_views (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null, -- anonymous, cookie-based, long-lived — used to count unique visitors, not identity
  path text not null,
  referrer text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_page_views_created on page_views(created_at desc);
create index idx_page_views_visitor on page_views(visitor_id, created_at desc);
