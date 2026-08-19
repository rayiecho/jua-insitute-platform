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
  learner,
  courseId,
  onLeave,
}: {
  learner?: Learner;
  courseId?: string;
  onLeave?: () => void;
}) {
  if (learner) return <Connector learner={learner} courseId={courseId} onLeave={onLeave} />;
  return <LearnerGate>{(l) => <Connector learner={l} courseId={courseId} onLeave={onLeave} />}</LearnerGate>;
}

function Connector({ learner, courseId, onLeave }: { learner: Learner; courseId?: string; onLeave?: () => void }) {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Live classes are session-independent by design (see TutorLobby) —
    // identity is resolved server-side from firstName + email against
    // platform_users, not from a browser session or a client-supplied id.
    // courseId is only meaningful when the learner has more than one
    // enrollment — TutorLobby collects it via a program picker so the tutor
    // coaches on the program the learner actually means, instead of
    // guessing from whichever they touched most recently.
    fetch('/api/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: learner.firstName, email: learner.email, courseId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (body.error === 'class_capacity_full') {
            throw new Error("All live classes are full right now — only a couple can run at once. Try again shortly.");
          }
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
  }, [learner.firstName, learner.email, courseId]);

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
          <p className="font-serif text-lg font-semibold text-ink">Hi {learner.firstName},</p>
          <p className="text-center text-sm text-ink/60">Your tutor will let you in shortly.</p>
          <button
            type="button"
            onClick={() => onLeave?.()}
            className="mt-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Hang up
          </button>
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
      video
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
