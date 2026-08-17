// The web app's API routes are the shared backend for both clients (Section 2:
// "Shared Code/State Updates" between web and mobile). Mobile can't use
// relative fetch('/api/...') like the web app does — needs an absolute URL to
// wherever apps/web is running. See .env.example for how to set this for
// physical-device testing.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set — see apps/mobile/.env.example');
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  return res;
}
