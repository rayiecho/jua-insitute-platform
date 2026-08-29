import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { WaveDivider } from './WaveDivider';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <WaveDivider />
      <div className="flex flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:pl-8 sm:pr-6">
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="font-serif text-sm font-semibold text-ink">Jua Institute</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink/60">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <Link href="/programs" className="hover:text-ink">
            Programs
          </Link>
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
          <Link href="/tutor" className="hover:text-ink">
            Talk to your tutor
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </nav>
        <p className="text-xs text-ink/40">© {new Date().getFullYear()} Jua Institute</p>
      </div>
    </footer>
  );
}
