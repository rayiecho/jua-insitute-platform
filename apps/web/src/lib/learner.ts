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
      const res = await fetch('/api/me');
      const data = await res.json();
      if (!cancelled) {
        setLearner(data.learner);
        setLoading(false);
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
