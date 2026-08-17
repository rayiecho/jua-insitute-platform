'use client';

import '@livekit/components-styles';
import { useEffect, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { TutorSessionUI } from './TutorSessionUI';
import { ClassroomShell } from './ClassroomShell';
import { LearnerGate } from '@/components/learner/LearnerGate';
import { LogoMark } from '@/components/brand/Logo';
import type { Learner } from '@/lib/learner';

interface ConnectionDetails {
  token: string;
  serverUrl: string;
}

// `learner` is optional so /session/[room] (a lower-level direct-join route)
// keeps working unchanged via its own LearnerGate; the lobby-driven /tutor
// flow passes an already-identified learner and skips straight to
// connecting. `onLeave` lets a caller (TutorLobby) return to its own "ready
// to join again?" screen instead of this component silently trying to
// reconnect on its own.
export function TutorSessionRoom({
  room,
  learner,
  onLeave,
}: {
  room: string;
  learner?: Learner;
  onLeave?: () => void;
}) {
  if (learner) return <Connector room={room} learner={learner} onLeave={onLeave} />;
  return <LearnerGate>{(l) => <Connector room={room} learner={l} onLeave={onLeave} />}</LearnerGate>;
}

function Connector({ room, learner, onLeave }: { room: string; learner: Learner; onLeave?: () => void }) {
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
      <ClassroomShell>
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
          <p className="text-sm text-red-600">{error}</p>
        </main>
      </ClassroomShell>
    );
  }

  if (!details) {
    return (
      <ClassroomShell>
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-5 px-6">
          <div className="animate-pulse">
            <LogoMark className="h-14 w-14" />
          </div>
          <p className="font-serif text-lg font-semibold text-ink">Joining as {learner.firstName}…</p>
          <p className="text-sm text-ink/50">Connecting you with your tutor</p>
        </main>
      </ClassroomShell>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={details.serverUrl}
      token={details.token}
      connect
      audio
      video={false}
      onDisconnected={() => {
        setDetails(null);
        onLeave?.();
      }}
      onError={(err) => setError(err.message)}
      className="min-h-screen"
    >
      <TutorSessionUI learner={learner} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
