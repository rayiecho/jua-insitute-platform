-- Tracks admin-triggered video generation and YouTube upload jobs, run by
-- the separate video-worker service on Railway (rendering can't happen on
-- Cloudflare Workers — no headless Chromium/ffmpeg, and it's real
-- multi-minute CPU work, not a fast web request). The admin UI polls this
-- table for status instead of waiting on a long HTTP request.

create table if not exists video_jobs (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references curriculum_nodes(id) on delete cascade,
  kind text not null check (kind in ('generate', 'youtube_upload')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  error text,
  result_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_jobs_node_id_idx on video_jobs(node_id);

-- curriculum_nodes.video_url already holds the rendered mp4; a separate
-- youtube_url column keeps that distinct once a video's also been posted.
alter table curriculum_nodes add column if not exists youtube_url text;
