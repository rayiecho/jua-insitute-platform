import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="text-sm font-medium text-ink/70">
          <Link href="/" className="hover:text-ink">
            Programs
          </Link>
        </nav>
      </div>
    </header>
  );
}
