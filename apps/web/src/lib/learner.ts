'use client';

const STORAGE_KEY = 'ai-tutor:learner';

export interface Learner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// Cache keyed by the raw string so getSnapshot returns a stable reference
// across calls when localStorage hasn't actually changed — required for
// useSyncExternalStore, which otherwise treats every new object as a change
// and re-renders forever.
let cachedRaw: string | null = null;
let cachedLearner: Learner | null = null;

function readSnapshot(): Learner | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedLearner;
  cachedRaw = raw;
  try {
    cachedLearner = raw ? (JSON.parse(raw) as Learner) : null;
  } catch {
    cachedLearner = null;
  }
  return cachedLearner;
}

export function getLearnerSnapshot(): Learner | null {
  return readSnapshot();
}

export function getLearnerServerSnapshot(): Learner | null {
  return null; // no localStorage during SSR
}

export function subscribeLearner(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function storeLearner(learner: Learner) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(learner));
  cachedRaw = null; // invalidate cache; storage events don't fire in the tab that wrote them
}

export async function registerLearner(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<Learner> {
  const res = await fetch('/api/learner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to register (${res.status})`);
  }
  const data = await res.json();
  const learner: Learner = { id: data.id, firstName: data.first_name, lastName: data.last_name, email: data.email };
  storeLearner(learner);
  return learner;
}
