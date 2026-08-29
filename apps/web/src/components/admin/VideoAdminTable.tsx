'use client';

import { useEffect, useRef, useState } from 'react';
import { TableShell } from './ui';

interface Row {
  id: string;
  title: string;
  slug: string;
  videoUrl: string | null;
  youtubeUrl: string | null;
  activeGenerateJobId: string | null;
  activeYoutubeJobId: string | null;
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
    // Real work already running server-side (Railway), independent of this
    // tab — polling just observes it. Clearing any prior timer for this key
    // first means resuming a job on page load can't end up with two
    // intervals racing each other.
    if (timers.current[key]) clearInterval(timers.current[key]);
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
  const [selectedCourseId, setSelectedCourseId] = useState(initialGroups[0]?.courseId ?? '');
  const generate = useJobPoller();
  const youtube = useJobPoller();

  // Resume polling for any job still running server-side from before this
  // page loaded — reopening the tab (or never having closed a different
  // one) shouldn't reset the UI to "idle" and invite a duplicate click on
  // work that's already genuinely in progress.
  useEffect(() => {
    for (const group of initialGroups) {
      for (const week of group.weeks) {
        for (const row of week.rows) {
          if (row.activeGenerateJobId) {
            generate.start(row.slug, row.activeGenerateJobId, (resultUrl) => {
              updateRow(row.slug, (r) => ({ ...r, videoUrl: resultUrl ?? r.videoUrl }));
            });
          }
          if (row.activeYoutubeJobId) {
            youtube.start(row.slug, row.activeYoutubeJobId, (resultUrl) => {
              updateRow(row.slug, (r) => ({ ...r, youtubeUrl: resultUrl ?? r.youtubeUrl }));
            });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Returns an error message on failure instead of alerting directly, so a
  // batch run can collect failures into one summary instead of popping up
  // a blocking alert() per lesson (genuinely bad if, say, an API quota is
  // exhausted and every one of 20 queued requests fails in a row).
  async function submitGenerate(slug: string): Promise<string | null> {
    try {
      const res = await fetch('/api/admin/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) return data.error ?? 'Failed to start generation';
      generate.start(slug, data.jobId, (resultUrl) => {
        updateRow(slug, (r) => ({ ...r, videoUrl: resultUrl ?? r.videoUrl }));
      });
      return null;
    } catch (err) {
      // A network failure or a non-JSON response (worker cold-starting,
      // an edge error page) previously threw here with no try/catch and no
      // .catch() on the click handler — an unhandled rejection the button
      // silently swallowed. Surface it the same way the handled case is.
      return err instanceof Error ? err.message : 'Failed to start generation';
    }
  }

  async function handleGenerate(slug: string) {
    const error = await submitGenerate(slug);
    if (error) alert(error);
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

  // Batch: queue every missing video in a set of rows, one request after
  // another with a short stagger — the server's own queue (apps/video's
  // enqueue/drainQueue) processes them one at a time regardless, this just
  // avoids firing 20+ POSTs in the same instant.
  const [batchRunning, setBatchRunning] = useState<string | null>(null);
  async function handleGenerateMissing(batchKey: string, rows: Row[]) {
    const targets = rows.filter((r) => !r.videoUrl && (generate.jobs[r.slug] ?? { status: 'idle' }).status !== 'polling');
    if (targets.length === 0) return;
    setBatchRunning(batchKey);
    const failures: string[] = [];
    for (const row of targets) {
      const error = await submitGenerate(row.slug);
      if (error) failures.push(`${row.title}: ${error}`);
      await new Promise((r) => setTimeout(r, 400));
    }
    setBatchRunning(null);
    if (failures.length > 0) {
      const shown = failures.slice(0, 5).join('\n');
      const more = failures.length > 5 ? `\n…and ${failures.length - 5} more` : '';
      alert(`Queued ${targets.length - failures.length}/${targets.length}. ${failures.length} failed:\n${shown}${more}`);
    }
  }

  const selectedGroup = groups.find((g) => g.courseId === selectedCourseId) ?? groups[0];

  if (groups.length === 0) {
    return <p className="text-sm text-ink/60">No lessons found.</p>;
  }

  return (
    <div>
      {/* Program tabs — replaces one long page of stacked, all-expanded
          sections (confirmed live: scrolling past an entire other program
          just to reach the next one was the actual complaint). Only the
          selected program's weeks render below. */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {groups.map((group) => {
          const { done, total } = countVideos(group);
          const active = group.courseId === selectedCourseId;
          return (
            <button
              key={group.courseId}
              type="button"
              onClick={() => setSelectedCourseId(group.courseId)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-ink text-white' : 'bg-card text-ink/70 hover:bg-ink/5'
              }`}
            >
              {group.courseTitle}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? 'bg-white/20 text-white' : done === total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {done}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {selectedGroup && (
        <div className="mt-6 space-y-6">
          {(() => {
            const allRows = selectedGroup.weeks.flatMap((w) => w.rows);
            const missingCount = allRows.filter((r) => !r.videoUrl).length;
            const isBatchRunning = batchRunning === `program:${selectedGroup.courseId}`;
            return (
              missingCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleGenerateMissing(`program:${selectedGroup.courseId}`, allRows)}
                  disabled={!!batchRunning}
                  className="rounded bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                >
                  {isBatchRunning ? 'Queuing…' : `Generate all missing in this program (${missingCount})`}
                </button>
              )
            );
          })()}

          {selectedGroup.weeks.map((week) => {
            const missingInWeek = week.rows.filter((r) => !r.videoUrl).length;
            const isBatchRunning = batchRunning === `week:${selectedGroup.courseId}:${week.label}`;
            return (
              <div key={week.label}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{week.label}</p>
                  {missingInWeek > 0 && (
                    <button
                      type="button"
                      onClick={() => handleGenerateMissing(`week:${selectedGroup.courseId}:${week.label}`, week.rows)}
                      disabled={!!batchRunning}
                      className="rounded border border-border bg-background px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-50"
                    >
                      {isBatchRunning ? 'Queuing…' : `Generate missing (${missingInWeek})`}
                    </button>
                  )}
                </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
