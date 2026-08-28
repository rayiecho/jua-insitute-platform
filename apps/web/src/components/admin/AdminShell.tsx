'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/brand/Logo';
import { AdminSignOutButton } from './AdminSignOutButton';

const NAV_GROUPS: { label: string | null; items: { href: string; label: string }[] }[] = [
  { label: null, items: [{ href: '/admin', label: 'Overview' }] },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/enrollments', label: 'Enrollments' },
      { href: '/admin/applications', label: 'Applications' },
      { href: '/admin/waitlist', label: 'Waitlist' },
    ],
  },
  {
    label: 'Learning',
    items: [
      { href: '/admin/classes', label: 'Classes' },
      { href: '/admin/submissions', label: 'Submissions' },
      { href: '/admin/quizzes', label: 'Quizzes' },
      { href: '/admin/videos', label: 'Videos' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/admin/analytics', label: 'Analytics' },
      { href: '/admin/costs', label: 'Costs' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function currentTitle(pathname: string) {
  // Longest-prefix match so a detail route like /admin/classes/abc123
  // still resolves to its section's label ("Classes") instead of falling
  // through to a generic default.
  const match = [...ALL_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.label ?? 'Admin';
}

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-ink px-4 py-3 md:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="font-serif text-sm font-semibold text-white">Jua Institute</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded border border-white/20 text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col overflow-y-auto bg-ink px-4 py-6 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : ''
        }`}
      >
        <div className="hidden items-center gap-2 px-2 md:flex">
          <Link href="/admin" className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-serif text-base font-semibold text-white">Jua Institute</span>
          </Link>
        </div>
        <div className="flex items-center justify-between px-2 md:hidden">
          <span className="font-serif text-base font-semibold text-white">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded border border-white/20 text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <span className="mt-2 w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-gold">
          Admin Panel
        </span>

        <nav className="mt-8 flex flex-1 flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? 'top'}>
              {group.label && (
                <p className="mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-wide text-white/40">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-2 pt-6">
          <Link href="/" className="block px-3 text-xs font-medium text-white/50 hover:text-white/80">
            ← Back to Jua Institute
          </Link>
          <AdminSignOutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="hidden items-center justify-between border-b border-border bg-background px-6 py-4 md:flex">
          <h1 className="font-serif text-lg font-semibold text-ink">{currentTitle(pathname)}</h1>
          <span className="text-sm text-ink/60">{email}</span>
        </div>
        <main className="flex-1 bg-background px-4 py-8 sm:px-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
