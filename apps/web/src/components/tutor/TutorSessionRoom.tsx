'use client';

import '@livekit/components-styles';
import { useEffect, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { TutorSessionUI } from './TutorSessionUI';
import { LearnerGate } from '@/components/learner/LearnerGate';
import type { Learner } from '@/lib/learner';

interface ConnectionDetails {
  token: string;
  serverUrl: string;
}

export function TutorSessionRoom({ room }: { room: string }) {
  return <LearnerGate>{(learner) => <Connector room={room} learner={learner} />}</LearnerGate>;
}

function Connector({ room, learner }: { room: string; learner: Learner }) {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Identity (learner.id) is a real platform_users UUID, not a free-text
    // name — the agent uses it verbatim as user_id for continuity/state-
    // injection queries (Section 4.4 / 4.1), so it has to be the real row id.
    fetch(`/api/livekit-token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(learner.id)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to fetch session token (${res.status})`);
        }
        return res.json() as Promise<ConnectionDetails>;
      })
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to join session');
      });
    return () => {
      cancelled = true;
    };
  }, [room, learner.id]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6">
        <p className="text-sm text-gray-500">Joining as {learner.firstName}…</p>
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
