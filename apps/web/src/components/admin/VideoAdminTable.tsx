'use client';

import { useEffect, useRef, useState } from 'react';

interface Row {
  id: string;
  title: string;
  slug: string;
  course?: string;
  videoUrl: string | null;
  youtubeUrl: string | null;
}

type JobState = { status: 'idle' } | { status: 'polling'; jobId: string } | { status: 'error'; message: string };

function useJobPoller() {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearInterval);
    };
  }, []);

  function start(key: string, jobId: string, onDone: (resultUrl: string | null) => void) {
    setJobs((j) => ({ ...j, [key]: { status: 'polling', jobId } }));
    timers.current[key] = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/videos/jobs/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Job lookup failed');
        if (data.status === 'succeeded') {
          clearInterval(timers.current[key]);
          setJobs((j) => ({ ...j, [key]: { status: 'idle' } }));
          onDone(data.result_url ?? null);
        } else if (data.status === 'failed') {
          clearInterval(timers.current[key]);
          setJobs((j) => ({ ...j, [key]: { status: 'error', message: data.error ?? 'Job failed' } }));
        }
      } catch (err) {
        clearInterval(timers.current[key]);
        setJobs((j) => ({ ...j, [key]: { status: 'error', message: err instanceof Error ? err.message : 'Failed' } }));
      }
    }, 5000);
  }

  return { jobs, start };
}

export function VideoAdminTable({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const generate = useJobPoller();
  const youtube = useJobPoller();

  async function handleGenerate(slug: string) {
    const res = await fetch('/api/admin/videos/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? 'Failed to start generation');
      return;
    }
    generate.start(slug, data.jobId, (resultUrl) => {
      setRows((rs) => rs.map((r) => (r.slug === slug ? { ...r, videoUrl: resultUrl ?? r.videoUrl } : r)));
    });
  }

  async function handlePostYouTube(slug: string) {
    const res = await fetch('/api/admin/videos/post-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? 'Failed to start YouTube upload');
      return;
    }
    youtube.start(slug, data.jobId, (resultUrl) => {
      setRows((rs) => rs.map((r) => (r.slug === slug ? { ...r, youtubeUrl: resultUrl ?? r.youtubeUrl } : r)));
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card text-left">
          <tr>
            <th className="px-4 py-2">Lesson</th>
            <th className="px-4 py-2">Video</th>
            <th className="px-4 py-2">YouTube</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const genState = generate.jobs[r.slug] ?? { status: 'idle' };
            const ytState = youtube.jobs[r.slug] ?? { status: 'idle' };
            return (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-ink/50">{r.course}</p>
                </td>
                <td className="px-4 py-3">
                  {r.videoUrl && (
                    <a href={r.videoUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-tan hover:text-ink">
                      View current →
                    </a>
                  )}
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => handleGenerate(r.slug)}
                      disabled={genState.status === 'polling'}
                      className="rounded bg-gold px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-50"
                    >
                      {genState.status === 'polling' ? 'Generating…' : r.videoUrl ? 'Regenerate' : 'Create Video'}
                    </button>
                    {genState.status === 'error' && <p className="mt-1 text-xs text-red-600">{genState.message}</p>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.youtubeUrl && (
                    <a href={r.youtubeUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-tan hover:text-ink">
                      View on YouTube →
                    </a>
                  )}
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => handlePostYouTube(r.slug)}
                      disabled={ytState.status === 'polling' || !r.videoUrl}
                      title={!r.videoUrl ? 'Generate a video first' : undefined}
                      className="rounded border border-border bg-background px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-50"
                    >
                      {ytState.status === 'polling' ? 'Uploading…' : r.youtubeUrl ? 'Re-post' : 'Post to YouTube'}
                    </button>
                    {ytState.status === 'error' && <p className="mt-1 text-xs text-red-600">{ytState.message}</p>}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-ink/60" colSpan={3}>
                No lessons found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
