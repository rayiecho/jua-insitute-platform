'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const VISITOR_COOKIE = 'jua_visitor_id';
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getOrCreateVisitorId(): string {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const id = crypto.randomUUID();
  document.cookie = `${VISITOR_COOKIE}=${id}; path=/; max-age=${VISITOR_COOKIE_MAX_AGE}; SameSite=Lax`;
  return id;
}

// Logs one page_views row per real navigation, client-side — server-side
// middleware would miss client-side route transitions entirely (Next.js App
// Router doesn't hit the server again for those), which is most of what
// "traffic" actually means for a single-page-feeling app like this one.
// visitor_id is a random cookie, not tied to any signed-in identity, so this
// works the same for anonymous visitors and signed-in learners alike.
export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, path: pathname, referrer: document.referrer || null }),
    }).catch(() => {
      // A missed page view isn't worth surfacing to the visitor.
    });
  }, [pathname]);

  return null;
}
