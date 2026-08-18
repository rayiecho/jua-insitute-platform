'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { TalkToTutorButton } from '@/components/programs/TalkToTutorButton';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/programs', label: 'Programs' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border">
      <div className="flex items-center justify-between pl-4 pr-4 py-4 sm:pl-8 sm:pr-6">
        <Link href="/" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-ink/70 hover:text-ink">
              {l.label}
            </Link>
          ))}
          <TalkToTutorButton className="rounded bg-gold px-4 py-2 font-semibold text-ink" />
        </nav>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex h-9 w-9 items-center justify-center rounded border border-border text-ink md:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 text-sm font-medium md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded px-2 py-2.5 text-ink/70 hover:bg-card hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <TalkToTutorButton
            className="mt-1 rounded bg-gold px-4 py-2.5 text-center font-semibold text-ink"
            onClick={() => setOpen(false)}
          />
        </nav>
      )}
    </header>
  );
}
