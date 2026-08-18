'use client';

import { useState } from 'react';
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
// nav items for pages we haven't built. On mobile the sidebar becomes a
// slide-out drawer behind a top-bar menu button — a permanent 256px
// sidebar would eat most of a phone screen otherwise.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-ink px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
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

      {/* Backdrop for mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col bg-ink px-4 py-6 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : ''
        }`}
      >
        <div className="hidden items-center gap-2 px-2 md:flex">
          <Link href="/" className="flex items-center gap-2">
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
          Student Portal
        </span>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
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

      <main className="flex-1 bg-background px-4 py-8 sm:px-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
