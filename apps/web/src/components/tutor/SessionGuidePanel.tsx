'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDataChannel } from '@livekit/components-react';
import { LessonVideo } from '@/components/programs/LessonVideo';

interface Guide {
  courseTitle: string | null;
  week: { weekNumber: number; title: string; summary: string; lessonTitles: string[] } | null;
  nodeTitle: string | null;
  nodeContent: string | null;
  videoUrl: string | null;
  assignmentTitle: string | null;
  assignmentInstructions: string | null;
}

// The "prepared slides... a guide for us" ask, built from what actually
// exists: the same lesson content and video the agent already teaches from
// (Section 4.4 continuity), not a new slide-authoring system. Doubles as the
// fix for "big white screens" — there's always something real to look at
// during a voice-only session.
export function SessionGuidePanel({
  learnerId,
  open,
  onClose,
}: {
  learnerId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [videoAnnounced, setVideoAnnounced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/session-guide?learnerId=${encodeURIComponent(learnerId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setGuide(data.guide ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  // The agent publishes this once, shortly after the opening line (see
  // apps/agent/src/room-interactions.ts) — used here just to surface a
  // "your tutor just shared this" moment, since the fetch above already has
  // the video URL regardless of whether this message ever arrives.
  useDataChannel('shared-video', () => setVideoAnnounced(true));

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="font-serif text-lg font-semibold text-ink">Session guide</p>
        <button type="button" onClick={onClose} className="text-sm text-ink/50 hover:text-ink">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!guide && <p className="text-sm text-ink/50">Loading your lesson guide…</p>}

        {guide && !guide.nodeTitle && (
          <p className="text-sm text-ink/50">Nothing enrolled yet — start a program to get a session guide.</p>
        )}

        {guide?.nodeTitle && (
          <>
            {guide.courseTitle && (
              <p className="text-xs font-semibold uppercase tracking-wide text-tan">{guide.courseTitle}</p>
            )}

            {guide.week && (
              <div className="mt-1 rounded-xl border border-border bg-background p-3">
                <p className="font-serif text-base font-semibold text-ink">
                  Week {guide.week.weekNumber}: {guide.week.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink/70">{guide.week.summary}</p>
                {guide.week.lessonTitles.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-ink/60">
                    {guide.week.lessonTitles.map((title) => (
                      <li key={title} className={title === guide.nodeTitle ? 'font-semibold text-ink' : ''}>
                        {title === guide.nodeTitle ? '→ ' : '• '}
                        {title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <h2 className="mt-4 font-serif text-xl font-semibold text-ink">{guide.nodeTitle}</h2>

            {guide.videoUrl && (
              <div
                className={`mt-4 rounded-xl border p-3 transition-colors ${
                  videoAnnounced ? 'border-gold bg-gold/5' : 'border-border bg-background'
                }`}
              >
                <p className="mb-2 text-sm font-medium text-ink">
                  {videoAnnounced ? '🎥 Your tutor just shared this video' : 'Prepared video for this lesson'}
                </p>
                <LessonVideo url={guide.videoUrl} />
              </div>
            )}

            {guide.nodeContent && (
              <article className="mt-4 space-y-3 text-sm leading-relaxed text-ink [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_h1]:font-serif [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-serif [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-ink [&_pre]:p-3 [&_pre]:text-background [&_pre_code]:bg-transparent [&_pre_code]:p-0">
                <ReactMarkdown>{guide.nodeContent}</ReactMarkdown>
              </article>
            )}

            {guide.assignmentTitle && (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="font-serif text-base font-semibold text-ink">{guide.assignmentTitle}</h3>
                {guide.assignmentInstructions && (
                  <article className="mt-2 space-y-3 text-sm leading-relaxed text-ink">
                    <ReactMarkdown>{guide.assignmentInstructions}</ReactMarkdown>
                  </article>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
