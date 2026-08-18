'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Surfaces failures from AuthHashHandler that would otherwise only show up
// in the browser console — a magic-link click that fails partway through
// (session established but the server-side verify call errors, say) needs
// to be visible on-screen, not silently swallowed, or "not verified" just
// keeps recurring with no way to tell why.
export function AuthErrorBanner() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const authError = searchParams.get('authError');
    if (!authError) return;
    setMessage(decodeURIComponent(authError));
    const params = new URLSearchParams(searchParams);
    params.delete('authError');
    const query = params.toString();
    router.replace(window.location.pathname + (query ? `?${query}` : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (!message) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
      {message}
      <button type="button" onClick={() => setMessage(null)} className="ml-3 underline">
        Dismiss
      </button>
    </div>
  );
}
