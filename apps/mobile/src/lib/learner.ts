import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';

const STORAGE_KEY = 'ai-tutor:learner';

export interface Learner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function getStoredLearner(): Promise<Learner | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Learner;
  } catch {
    return null;
  }
}

export async function registerLearner(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<Learner> {
  const res = await apiFetch('/api/learner', {
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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(learner));
  return learner;
}
