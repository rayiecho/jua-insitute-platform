'use client';

import { useEffect, useRef, useState } from 'react';
import { TableShell, Badge } from './ui';

interface Row {
  id: string;
  title: string;
  slug: string;
  videoUrl: string | null;
  youtubeUrl: string | null;
}

interface WeekGroup {
  label: string;
  rows: Row[];
}

export interface CourseGroup {
  courseId: string;
  courseTitle: string;
  weeks: WeekGroup[];
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

function countVideos(group: CourseGroup): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const week of group.weeks) {
    for (const row of week.rows) {
      total += 1;
      if (row.videoUrl) done += 1;
    }
  }
  return { done, total };
}

export function VideoAdminTable({ groups: initialGroups }: { groups: CourseGroup[] }) {
  const [groups, setGroups] = useState(initialGroups);
  const generate = useJobPoller();
  const youtube = useJobPoller();

  function updateRow(slug: string, updater: (row: Row) => Row) {
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        weeks: g.weeks.map((w) => ({
          ...w,
          rows: w.rows.map((r) => (r.slug === slug ? updater(r) : r)),
        })),
      })),
    );
  }

  async function handleGenerate(slug: string) {
    try {
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
        updateRow(slug, (r) => ({ ...r, videoUrl: resultUrl ?? r.videoUrl }));
      });
    } catch (err) {
      // A network failure or a non-JSON response (worker cold-starting,
      // an edge error page) previously threw here with no try/catch and no
      // .catch() on the click handler — an unhandled rejection the button
      // silently swallowed. Surface it the same way the handled case is.
      alert(err instanceof Error ? err.message : 'Failed to start generation');
    }
  }

  async function handlePostYouTube(slug: string) {
    try {
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
        updateRow(slug, (r) => ({ ...r, youtubeUrl: resultUrl ?? r.youtubeUrl }));
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start YouTube upload');
    }
  }

  if (groups.length === 0) {
    return <p className="text-sm text-ink/60">No lessons found.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const { done, total } = countVideos(group);
        return (
          <details key={group.courseId} className="rounded-lg border border-border bg-card" open>
            <summary className="flex cursor-pointer items-center justify-between px-5 py-3 [&::-webkit-details-marker]:hidden">
              <span className="font-serif text-lg font-semibold text-ink">{group.courseTitle}</span>
              <Badge tone={done === total ? 'green' : 'amber'}>
                {done}/{total} have videos
              </Badge>
            </summary>
            <div className="space-y-5 border-t border-border p-4">
              {group.weeks.map((week) => (
                <div key={week.label}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{week.label}</p>
                  <TableShell>
                    <thead className="bg-background text-left">
                      <tr>
                        <th className="px-4 py-2">Lesson</th>
                        <th className="px-4 py-2">Video</th>
                        <th className="px-4 py-2">YouTube</th>
                      </tr>
                    </thead>
                    <tbody>
                      {week.rows.map((r) => {
                        const genState = generate.jobs[r.slug] ?? { status: 'idle' };
                        const ytState = youtube.jobs[r.slug] ?? { status: 'idle' };
                        return (
                          <tr key={r.id} className="border-t border-border align-top">
                            <td className="px-4 py-3">
                              <p className="font-medium text-ink">{r.title}</p>
                            </td>
                            <td className="px-4 py-3">
                              {r.videoUrl && (
                                <a
                                  href={r.videoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-medium text-tan hover:text-ink"
                                >
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
                                <a
                                  href={r.youtubeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-medium text-tan hover:text-ink"
                                >
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
                    </tbody>
                  </TableShell>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
