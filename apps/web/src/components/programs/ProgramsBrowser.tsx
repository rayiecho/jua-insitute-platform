import { ProgramCard, type Program } from './ProgramCard';

// A real catalog page — a grid of programs the way Canvas/any course
// catalog presents them, not a sidebar-tab browser hiding everything but
// one program at a time behind a click. Server-rendered (no client state of
// its own); WaitlistForm is the only interactive island.
export function ProgramsBrowser({
  programs,
  enrolledCourseIds,
}: {
  programs: Program[];
  enrolledCourseIds: string[];
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16 md:px-8">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-tan">Jua Institute</span>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-ink sm:text-5xl">Programs</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink/70">
          Real curriculum, a live AI tutor twice a week, and an always-available guide the rest of the time — pick a
          program and start today.
        </p>
      </div>

      {programs.length === 0 ? (
        <p className="mt-12 text-ink/60">No programs published yet.</p>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} enrolled={enrolledCourseIds.includes(program.id)} />
          ))}
        </div>
      )}
    </main>
  );
}
