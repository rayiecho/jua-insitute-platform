'use client';

import { useState } from 'react';
import Link from 'next/link';

const LESSON_TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  reading: 'Reading',
  case_study: 'Case study',
  quiz: 'Quiz',
  puzzle: 'Exercise',
};

interface Node {
  id: string;
  title: string;
  slug: string;
  lesson_type: string;
}

interface Week {
  id: string;
  week_number: number;
  title: string;
  summary: string;
  is_final_assessment: boolean;
}

// Collapsible, Canvas-style: weeks expand/collapse, each lesson shows its
// type and a completion checkmark or lock icon.
export function ProgramSyllabus({
  weeks,
  nodesByWeek,
  completedIds,
  lockedIds,
}: {
  weeks: Week[];
  nodesByWeek: Record<string, Node[]>;
  completedIds: string[];
  lockedIds: string[];
}) {
  const [openWeekId, setOpenWeekId] = useState<string | null>(weeks[0]?.id ?? null);
  const completed = new Set(completedIds);
  const locked = new Set(lockedIds);

  return (
    <div className="mt-12 space-y-3">
      <h2 className="font-serif text-xl font-semibold text-ink">Program structure</h2>
      {weeks.map((week) => {
        const weekNodes = nodesByWeek[week.id] ?? [];
        const isOpen = openWeekId === week.id;
        const doneCount = weekNodes.filter((n) => completed.has(n.id)).length;

        return (
          <div key={week.id} className="rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpenWeekId(isOpen ? null : week.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-lg font-semibold text-tan">
                  {week.is_final_assessment ? 'Final' : `Week ${week.week_number}`}
                </span>
                <span className="font-serif text-lg font-semibold text-ink">{week.title}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink/50">
                {weekNodes.length > 0 && (
                  <span>
                    {doneCount}/{weekNodes.length}
                  </span>
                )}
                <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border">
                <p className="px-5 py-3 text-sm text-ink/60">{week.summary}</p>
                {weekNodes.length > 0 ? (
                  <ol className="divide-y divide-border">
                    {weekNodes.map((node) => {
                      const isLocked = locked.has(node.id);
                      const isDone = completed.has(node.id);
                      return (
                        <li key={node.id}>
                          <Link
                            href={isLocked ? '#' : `/learn/${node.slug}`}
                            aria-disabled={isLocked}
                            className={`flex items-center justify-between gap-4 px-5 py-3 ${
                              isLocked ? 'text-ink/30' : 'hover:bg-background'
                            }`}
                          >
                            <span className="flex items-center gap-2 font-medium text-ink">
                              <span className="w-4 text-center text-sm">
                                {isDone ? '✓' : isLocked ? '🔒' : ''}
                              </span>
                              {node.title}
                            </span>
                            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink/40">
                              {LESSON_TYPE_LABEL[node.lesson_type] ?? node.lesson_type}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="px-5 pb-4 text-sm italic text-ink/40">Content coming soon.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
