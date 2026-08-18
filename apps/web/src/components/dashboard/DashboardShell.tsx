import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { SignOutButton } from './SignOutButton';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '🏠' },
  { href: '/programs', label: 'Programs', icon: '📚' },
  { href: '/tutor', label: 'Live tutor', icon: '🎓' },
];

// The learner's home base — a dedicated app shell (dark sidebar + light
// content) distinct from the marketing site's header/footer, matching how
// real learning platforms separate "browsing" from "your workspace." Only
// links to pages that actually exist — no invented Settings/Certificates
// nav items for pages we haven't built.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-ink px-4 py-6">
        <Link href="/" className="flex items-center gap-2 px-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-serif text-base font-semibold text-white">Jua Institute</span>
        </Link>
        <span className="mt-2 w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-gold">
          Student Portal
        </span>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 bg-background px-8 py-10">{children}</main>
    </div>
  );
}
