'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from './supabase/client';

export interface Learner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// Real auth session, not localStorage — replaces the old name/email stand-in.
// `loading` stays true until the initial session check resolves, so callers
// can distinguish "not signed in" from "haven't checked yet."
export function useLearnerSession(): { learner: Learner | null; loading: boolean; signOut: () => Promise<void> } {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function loadLearner() {
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (!cancelled) setLearner(data.learner);
      } catch {
        // Network hiccup, cold dev-server compile, etc. — fall through to
        // "not signed in" rather than hanging on "Checking your session…"
        // forever. A real session will resolve correctly on the next check.
        if (!cancelled) setLearner(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLearner();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadLearner();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    setLearner(null);
  }

  return { learner, loading, signOut };
}
