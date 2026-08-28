import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { EmailAuthForm } from '@/components/auth/EmailAuthForm';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

// Real access control: only this email can reach /admin, verified through
// the same magic-link flow every other sign-in uses — there's no separate
// "admin mode" that skips verification, admin access still requires a
// verified session, it's just also checked against this one address.
const ADMIN_EMAIL = 'r.ayiecho@alustudent.com';

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

  return <AdminShell email={user.email ?? ''}>{children}</AdminShell>;
}
