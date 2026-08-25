import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { processLesson } from './scripts/generate-lesson-video.mjs';
import { uploadToYouTube } from './scripts/youtube.mjs';
import { getEnvVar } from './scripts/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', path.join(ROOT, '..', 'web', '.env.local'));
const SUPABASE_SERVICE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', path.join(ROOT, '..', 'web', '.env.local'));
// Shared secret the admin API route sends — this service is reachable over
// the public internet (Railway), and it can trigger real spend (Groq,
// Deepgram, YouTube) and real DB writes, so it isn't left open.
const WORKER_SECRET = getEnvVar('VIDEO_WORKER_SECRET');

async function supabase(pathAndQuery, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${pathAndQuery} failed: ${res.status} ${await res.text()}`);
  return res;
}

async function createJob(nodeId, kind) {
  const res = await supabase('/rest/v1/video_jobs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ node_id: nodeId, kind, status: 'queued' }),
  });
  const [job] = await res.json();
  return job;
}

async function updateJob(id, fields) {
  await supabase(`/rest/v1/video_jobs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

async function getNode(nodeIdOrSlug, bySlug = false) {
  const filter = bySlug ? `slug=eq.${nodeIdOrSlug}` : `id=eq.${nodeIdOrSlug}`;
  const res = await supabase(`/rest/v1/curriculum_nodes?select=id,slug,title,video_url&${filter}`);
  const rows = await res.json();
  if (rows.length === 0) throw new Error(`No lesson found (${bySlug ? 'slug' : 'id'}=${nodeIdOrSlug})`);
  return rows[0];
}

// Video generation is real, sequential CPU/GPU-bound work (headless
// Chromium render) — one job at a time, queued, rather than trying to run
// several renders concurrently on one Railway instance.
const queue = [];
let processing = false;

function enqueue(job) {
  queue.push(job);
  void drainQueue();
}

async function drainQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const job = queue.shift();
    try {
      await job();
    } catch (err) {
      console.error('Job failed:', err);
    }
  }
  processing = false;
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/generate', async (req, res) => {
  if (req.headers.authorization !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { slug } = req.body ?? {};
  if (!slug) return res.status(400).json({ error: 'slug is required' });

  let node;
  try {
    node = await getNode(slug, true);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  let job;
  try {
    job = await createJob(node.id, 'generate');
  } catch (err) {
    return res.status(500).json({ error: `Could not create job: ${err.message}` });
  }
  res.status(202).json({ jobId: job.id });

  enqueue(async () => {
    await updateJob(job.id, { status: 'running' });
    try {
      const { videoUrl } = await processLesson(slug, (msg) => console.log(`[job ${job.id}] ${msg}`));
      await updateJob(job.id, { status: 'succeeded', result_url: videoUrl });
    } catch (err) {
      console.error(`[job ${job.id}] FAILED:`, err);
      await updateJob(job.id, { status: 'failed', error: String(err?.message ?? err) });
    }
  });
});

app.post('/post-youtube', async (req, res) => {
  if (req.headers.authorization !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { slug } = req.body ?? {};
  if (!slug) return res.status(400).json({ error: 'slug is required' });

  let node;
  try {
    node = await getNode(slug, true);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
  if (!node.video_url) {
    return res.status(400).json({ error: 'This lesson has no rendered video yet — generate one first.' });
  }

  let job;
  try {
    job = await createJob(node.id, 'youtube_upload');
  } catch (err) {
    return res.status(500).json({ error: `Could not create job: ${err.message}` });
  }
  res.status(202).json({ jobId: job.id });

  enqueue(async () => {
    await updateJob(job.id, { status: 'running' });
    try {
      const videoRes = await fetch(node.video_url);
      if (!videoRes.ok) throw new Error(`Could not fetch rendered video: ${videoRes.status}`);
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

      const youtubeUrl = await uploadToYouTube({
        videoBuffer,
        title: `${node.title} | Jua Institute`,
        description: `${node.title} — part of a real, project-based course at Jua Institute.`,
      });

      await supabase(`/rest/v1/curriculum_nodes?id=eq.${node.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });
      await updateJob(job.id, { status: 'succeeded', result_url: youtubeUrl });
    } catch (err) {
      console.error(`[job ${job.id}] FAILED:`, err);
      await updateJob(job.id, { status: 'failed', error: String(err?.message ?? err) });
    }
  });
});

app.get('/jobs/:id', async (req, res) => {
  const r = await supabase(`/rest/v1/video_jobs?id=eq.${req.params.id}`);
  const [job] = await r.json();
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Defense in depth: an unhandled rejection anywhere (a spot this file
// missed wrapping) should log and keep serving other requests, not crash
// the whole process — confirmed live (2026-08-25) that the missing
// video_jobs table did exactly that before this was added.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (not crashing):', err);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`video-worker listening on :${PORT}`));
