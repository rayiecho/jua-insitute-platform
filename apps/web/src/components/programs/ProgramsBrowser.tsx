'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WaitlistForm } from './WaitlistForm';

interface Week {
  weekNumber: number;
  title: string;
  isFinal: boolean;
}

interface Program {
  id: string;
  title: string;
  description: string;
  tagline: string | null;
  difficulty_level: string;
  status: string;
  slug: string | null;
  lessonCount: number;
  weeks: Week[];
}

export function ProgramsBrowser({ programs }: { programs: Program[] }) {
  const [selectedId, setSelectedId] = useState(programs[0]?.id ?? null);
  const selected = programs.find((p) => p.id === selectedId) ?? programs[0] ?? null;

  return (
    <main className="flex w-full flex-1 gap-10 pl-8 pr-6 py-10">
      <aside className="w-64 shrink-0">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Programs</p>
        <nav className="mt-3 flex flex-col gap-1">
          {programs.map((program) => {
            const isSelected = program.id === selected?.id;
            return (
              <button
                key={program.id}
                type="button"
                onClick={() => setSelectedId(program.id)}
                className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors ${
                  isSelected ? 'border-gold bg-gold/10' : 'border-transparent text-ink/70 hover:bg-card'
                }`}
              >
                <span className={`text-sm font-medium ${isSelected ? 'text-ink' : ''}`}>{program.title}</span>
                <span className="mt-0.5 text-xs text-ink/50">
                  {program.status === 'live' ? 'Live now' : 'Coming soon'}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {selected && (
        <section className="min-w-0 flex-1">
          {/* Header band — fills the space instead of a lone text stack. */}
          <div className="rounded-2xl border border-border bg-card px-10 py-12">
            <span className="text-xs font-semibold tracking-wide text-tan uppercase">
              {selected.difficulty_level}
            </span>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">{selected.title}</h1>
            {selected.tagline && <p className="mt-3 max-w-xl text-lg text-ink/70">{selected.tagline}</p>}
            <p className="mt-4 max-w-2xl text-ink/70">{selected.description}</p>

            <div className="mt-8">
              {selected.status === 'live' && selected.slug ? (
                <Link
                  href={`/programs/${selected.slug}`}
                  className="inline-flex items-center rounded bg-gold px-6 py-3 text-sm font-semibold text-ink"
                >
                  View syllabus &amp; start
                </Link>
              ) : (
                <div className="max-w-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
                    Join the waitlist — we&apos;ll email you at launch
                  </p>
                  <WaitlistForm courseId={selected.id} />
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Stat
              label="Duration"
              value={
                selected.weeks.length > 0
                  ? `${selected.weeks.filter((w) => !w.isFinal).length} weeks + final`
                  : '4–10 weeks'
              }
            />
            <Stat label="Live classes" value="2× per week" />
            <Stat label="Lessons" value={selected.lessonCount > 0 ? `${selected.lessonCount}` : 'In progress'} />
          </div>

          {/* Week-by-week syllabus, when the structure exists */}
          {selected.weeks.length > 0 && (
            <div className="mt-10">
              <h2 className="font-serif text-xl font-semibold text-ink">Program structure</h2>
              <ol className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
                {selected.weeks.map((week) => (
                  <li key={week.weekNumber} className="flex items-center gap-4 px-5 py-4">
                    <span className="font-serif text-lg text-tan">
                      {week.isFinal ? 'Final' : `W${week.weekNumber}`}
                    </span>
                    <span className="font-medium text-ink">{week.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {programs.length === 0 && <p className="text-ink/60">No programs published yet.</p>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 font-serif text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
