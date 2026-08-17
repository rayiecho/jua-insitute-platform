'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WaitlistForm } from './WaitlistForm';

interface Program {
  id: string;
  title: string;
  description: string;
  tagline: string | null;
  difficulty_level: string;
  status: string;
  slug: string | null;
  lessonCount: number;
}

export function ProgramsBrowser({ programs }: { programs: Program[] }) {
  const [selectedId, setSelectedId] = useState(programs[0]?.id ?? null);
  const selected = programs.find((p) => p.id === selectedId) ?? programs[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 gap-10 px-6 py-14">
      <aside className="w-56 shrink-0">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Programs</p>
        <nav className="mt-3 flex flex-col gap-1">
          {programs.map((program) => {
            const isSelected = program.id === selected?.id;
            return (
              <button
                key={program.id}
                type="button"
                onClick={() => setSelectedId(program.id)}
                className={`flex flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isSelected ? 'bg-gold/10 text-ink' : 'text-ink/70 hover:bg-card'
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
          <span className="text-xs font-semibold tracking-wide text-tan uppercase">{selected.difficulty_level}</span>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-ink">{selected.title}</h1>
          {selected.tagline && <p className="mt-2 text-lg text-ink/70">{selected.tagline}</p>}
          <p className="mt-4 max-w-2xl text-ink/70">{selected.description}</p>

          {selected.status === 'live' && (
            <p className="mt-4 text-sm text-ink/50">
              {selected.lessonCount} {selected.lessonCount === 1 ? 'lesson' : 'lessons'} so far — more added in
              stages.
            </p>
          )}

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
        </section>
      )}

      {programs.length === 0 && <p className="text-ink/60">No programs published yet.</p>}
    </main>
  );
}
