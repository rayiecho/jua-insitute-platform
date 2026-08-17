import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export const dynamic = 'force-dynamic';

// Not linked from any public nav and not access-gated yet — same posture as
// /admin/costs already had (see that page's original comment): no real
// admin-role concept exists in platform_users yet, and picking an arbitrary
// email allowlist without being told which address(es) should have admin
// rights would be guessing. Add real access control before this goes public.
const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/enrollments', label: 'Enrollments' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/submissions', label: 'Submissions' },
  { href: '/admin/quizzes', label: 'Quizzes' },
  { href: '/admin/costs', label: 'Costs' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="flex items-center justify-between pl-8 pr-6 py-4">
          <Link href="/">
            <Logo />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Admin</span>
        </div>
        <nav className="flex gap-1 pl-8 pr-6 pb-3 text-sm font-medium">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded px-3 py-1.5 text-ink/70 hover:bg-card hover:text-ink"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="pl-8 pr-6 py-10">{children}</main>
    </div>
  );
}
