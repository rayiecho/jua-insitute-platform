import Link from 'next/link';
import { WaitlistForm } from './WaitlistForm';

interface Week {
  weekNumber: number;
  title: string;
  isFinal: boolean;
}

export interface Program {
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

export function ProgramCard({ program, enrolled }: { program: Program; enrolled: boolean }) {
  const weekCount = program.weeks.filter((w) => !w.isFinal).length;
  const isLive = program.status === 'live';

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-200 hover:shadow-[0_8px_30px_-12px_rgba(20,20,20,0.15)]">
      <div className="flex items-start justify-between px-6 pt-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
          <ProgramIcon title={program.title} />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-gold-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Live now
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-semibold text-ink/50">
              Coming soon
            </span>
          )}
          {enrolled && (
            <span className="inline-flex items-center rounded-full border border-gold/40 px-2.5 py-1 text-[11px] font-semibold text-gold-dark">
              Enrolled
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-tan">{program.difficulty_level}</span>
        <h2 className="mt-1.5 font-serif text-xl font-semibold leading-snug text-ink">{program.title}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/65">
          {program.tagline || program.description}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink/50">
          <span className="flex items-center gap-1.5">
            <CalendarIcon />
            {weekCount > 0 ? `${weekCount} weeks + final` : '4–10 weeks'}
          </span>
          <span className="flex items-center gap-1.5">
            <BookIcon />
            {program.lessonCount > 0 ? `${program.lessonCount} lessons` : 'In progress'}
          </span>
          <span className="flex items-center gap-1.5">
            <VideoIcon />
            2×/week live
          </span>
        </div>

        <div className="mt-6 flex-1" />

        {isLive && enrolled ? (
          <div className="flex flex-col gap-2">
            <Link
              href={program.slug ? `/programs/${program.slug}` : '/dashboard'}
              className="inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-dark"
            >
              Continue learning
            </Link>
            {/* The card's PRIMARY action is the course content (syllabus,
                lessons, progress) — confirmed live 2026-08-20 that routing
                straight into the live voice room from here, with no way to
                see any course content first, was the actual complaint. Live
                class is still one click away, just not the only option. */}
            <Link href="/tutor" className="text-center text-xs font-medium text-tan hover:text-ink">
              Join live class →
            </Link>
          </div>
        ) : isLive && program.slug ? (
          <Link
            href={`/programs/${program.slug}`}
            className="inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-dark"
          >
            View syllabus &amp; start
          </Link>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium text-ink/50">We&apos;ll email you at launch</p>
            <WaitlistForm courseId={program.id} />
          </div>
        )}
      </div>
    </div>
  );
}

// A small, deliberate icon set instead of a generic placeholder square —
// picked by keyword since courses have no category column in the schema
// (see apps/agent's isProgrammingCourse for the same constraint).
function ProgramIcon({ title }: { title: string }) {
  const t = title.toLowerCase();
  if (/python|program|coding|software|developer|it fundamentals|it professional/.test(t)) return <CodeIcon />;
  if (/entrepreneur|business|startup/.test(t)) return <BriefcaseIcon />;
  if (/workspace|docs|sheets|productivity/.test(t)) return <GridIcon />;
  return <CapIcon />;
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="18" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function CapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 9l10-5 10 5-10 5-10-5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 11v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4.5" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M3 9.5h18M8 3v3M16 3v3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="13" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 10.5l5-3v9l-5-3" />
    </svg>
  );
}
