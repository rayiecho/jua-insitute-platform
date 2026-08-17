import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { TalkToTutorButton } from '@/components/programs/TalkToTutorButton';

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="flex items-center justify-between pl-8 pr-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="text-ink/70 hover:text-ink">
            Home
          </Link>
          <Link href="/programs" className="text-ink/70 hover:text-ink">
            Programs
          </Link>
          <Link href="/dashboard" className="text-ink/70 hover:text-ink">
            Dashboard
          </Link>
          <TalkToTutorButton className="rounded bg-gold px-4 py-2 font-semibold text-ink" />
        </nav>
      </div>
    </header>
  );
}
