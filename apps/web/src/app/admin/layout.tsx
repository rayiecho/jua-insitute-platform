import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { EmailAuthForm } from '@/components/auth/EmailAuthForm';

export const dynamic = 'force-dynamic';

// Real access control: only this email can reach /admin, verified through
// the same magic-link flow every other sign-in uses — there's no separate
// "admin mode" that skips verification, admin access still requires a
// verified session, it's just also checked against this one address.
const ADMIN_EMAIL = 'r.ayiecho@alustudent.com';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/enrollments', label: 'Enrollments' },
  { href: '/admin/classes', label: 'Classes' },
  { href: '/admin/applications', label: 'Applications' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/submissions', label: 'Submissions' },
  { href: '/admin/quizzes', label: 'Quizzes' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/costs', label: 'Costs' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6">
        <Logo />
        <p className="mt-6 text-center text-sm text-ink/60">Admin sign-in — verify to continue.</p>
        <div className="mt-4 w-full">
          <EmailAuthForm mode="signin" next="/admin" />
        </div>
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <p className="font-serif text-xl font-semibold text-ink">Not authorized</p>
        <p className="mt-2 text-sm text-ink/60">
          Signed in as {user.email}, which doesn&apos;t have admin access.
        </p>
        <Link href="/" className="mt-4 text-sm font-medium text-tan hover:text-ink">
          ← Back to Jua Institute
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-4 sm:pl-8 sm:pr-6">
          <Link href="/">
            <Logo />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 text-sm font-medium sm:pl-8 sm:pr-6">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="shrink-0 rounded px-3 py-1.5 text-ink/70 hover:bg-card hover:text-ink"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="px-4 py-8 sm:pl-8 sm:pr-6 sm:py-10">{children}</main>
    </div>
  );
}
