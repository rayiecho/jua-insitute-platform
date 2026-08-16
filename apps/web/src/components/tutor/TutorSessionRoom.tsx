'use client';

import '@livekit/components-styles';
import { useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { TutorSessionUI } from './TutorSessionUI';

interface ConnectionDetails {
  token: string;
  serverUrl: string;
}

export function TutorSessionRoom({ room }: { room: string }) {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const identity = name.trim();
    if (!identity) return;

    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/livekit-token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(identity)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch session token (${res.status})`);
      }
      const data = (await res.json()) as ConnectionDetails;
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setConnecting(false);
    }
  }

  if (!details) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
        <h1 className="text-xl font-semibold">Join tutoring session</h1>
        <p className="text-sm text-gray-500">Room: {room}</p>
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input
            className="rounded border border-gray-300 px-3 py-2"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={connecting || !name.trim()}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {connecting ? 'Joining…' : 'Join'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={details.serverUrl}
      token={details.token}
      connect
      audio
      video={false}
      onDisconnected={() => setDetails(null)}
      onError={(err) => setError(err.message)}
      className="min-h-screen"
    >
      <TutorSessionUI />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
