'use client';

import { useState } from 'react';
import { Track } from 'livekit-client';
import type { TrackReference } from '@livekit/components-core';
import {
  BarVisualizer,
  DisconnectButton,
  StartAudio,
  VideoTrack,
  useDataChannel,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { LogoMark } from '@/components/brand/Logo';
import { ClassroomShell } from './ClassroomShell';
import { SessionGuidePanel } from './SessionGuidePanel';
import type { Learner } from '@/lib/learner';

const AGENT_STATE_LABEL: Record<string, string> = {
  disconnected: 'Waiting to connect…',
  connecting: 'Connecting…',
  initializing: 'Getting ready…',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
};

const REACTIONS = ['👍', '🎉', '❓', '👏'];

// The live classroom, laid out as a real two-way video call — the tutor's
// avatar as the main stage, the learner's own camera as a self-view tile in
// the corner (Google Meet-style), both genuinely visible to each other. The
// learner's camera now auto-publishes on join (see video prop on
// LiveKitRoom in TutorSessionRoom.tsx) rather than being a disabled
// placeholder button — raise hand, reactions, screen share, and a session
// guide panel (standing in for prepared slides, built from the same lesson
// content the tutor teaches from) round out the interaction layer.
export function TutorSessionUI({ learner }: { learner: Learner }) {
  const { state, audioTrack } = useVoiceAssistant();
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant();
  const [guideOpen, setGuideOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks[0];
  // The Simli avatar (apps/agent/src/simli-avatar.ts) publishes real video
  // into the room as its own participant ("simli-avatar-agent") once
  // SIMLI_FACE_ID is set. useTracks() only returns tracks matching the
  // requested source list — Simli's actual publish source was never
  // confirmed (their docs don't say), so this is widened to every known
  // video source rather than assuming Camera specifically.
  const videoTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown]);
  const avatarVideoTrack = videoTracks.find(
    (t) => !t.participant.isLocal && t.source !== Track.Source.ScreenShare,
  );
  const localCameraTrack = videoTracks.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);

  const { send: sendHandRaise } = useDataChannel('hand-raise');
  const { send: sendReaction } = useDataChannel('reaction', (msg) => {
    try {
      const { emoji } = JSON.parse(new TextDecoder().decode(msg.payload)) as { emoji: string };
      addReaction(emoji);
    } catch {
      // ignore malformed payload
    }
  });

  const stateLabel = AGENT_STATE_LABEL[state] ?? state;
  const isLive = state === 'listening' || state === 'thinking' || state === 'speaking';

  function addReaction(emoji: string) {
    const id = Date.now() + Math.random();
    setReactions((prev) => [...prev, { id, emoji }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2000);
  }

  function toggleHandRaise() {
    const next = !handRaised;
    setHandRaised(next);
    void sendHandRaise(new TextEncoder().encode(JSON.stringify({ raised: next, name: learner.firstName })), {
      reliable: true,
    });
    if (next) addReaction('✋');
  }

  function sendEmoji(emoji: string) {
    addReaction(emoji);
    void sendReaction(new TextEncoder().encode(JSON.stringify({ emoji })), { reliable: false });
  }

  return (
    <ClassroomShell>
      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-ink/60">
            <LogoMark className="h-5 w-5" />
            <span>Live class</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
            <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-gold' : 'bg-border'}`} />
            {stateLabel}
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
          {screenShareTrack ? (
            <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-ink shadow-sm">
              <VideoTrack trackRef={screenShareTrack} className="h-full w-full" />
            </div>
          ) : avatarVideoTrack ? (
            <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-ink shadow-sm">
              <VideoTrack trackRef={avatarVideoTrack} className="h-full w-full object-cover" />
            </div>
          ) : (
            <TutorTile state={state} audioTrack={audioTrack} label={stateLabel} />
          )}

          <LearnerTile learner={learner} cameraTrack={localCameraTrack} micOn={isMicrophoneEnabled} handRaised={handRaised} />

          {/* Floating reactions rise from the center of the stage. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-1/3 flex justify-center">
            {reactions.map((r) => (
              <span
                key={r.id}
                className="absolute text-4xl"
                style={{ animation: 'float-up 2s ease-out forwards' }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border px-6 py-5">
          <StartAudio
            label="Click to enable audio"
            className="rounded bg-gold px-4 py-2 text-sm font-semibold text-ink"
          />

          <button
            type="button"
            onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              isMicrophoneEnabled ? 'border-border text-ink hover:bg-card' : 'border-red-300 bg-red-50 text-red-600'
            }`}
          >
            {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          </button>

          <button
            type="button"
            onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              isCameraEnabled ? 'border-border text-ink hover:bg-card' : 'border-red-300 bg-red-50 text-red-600'
            }`}
          >
            {isCameraEnabled ? 'Stop video' : 'Start video'}
          </button>

          <button
            type="button"
            onClick={toggleHandRaise}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              handRaised ? 'border-gold bg-gold/10 text-gold-dark' : 'border-border text-ink hover:bg-card'
            }`}
          >
            ✋ {handRaised ? 'Lower hand' : 'Raise hand'}
          </button>

          <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1.5">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => sendEmoji(emoji)}
                className="rounded-full px-1.5 py-1 text-lg hover:bg-card"
                title="Send a reaction"
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              isScreenShareEnabled ? 'border-gold bg-gold/10 text-gold-dark' : 'border-border text-ink hover:bg-card'
            }`}
          >
            {isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
          </button>

          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              guideOpen ? 'border-gold bg-gold/10 text-gold-dark' : 'border-border text-ink hover:bg-card'
            }`}
          >
            Guide
          </button>

          <DisconnectButton className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
            Leave
          </DisconnectButton>
        </div>
      </main>

      <SessionGuidePanel learnerId={learner.id} open={guideOpen} onClose={() => setGuideOpen(false)} />
    </ClassroomShell>
  );
}

function TutorTile({
  state,
  audioTrack,
  label,
}: {
  state: string;
  audioTrack: Parameters<typeof BarVisualizer>[0]['track'];
  label: string;
}) {
  const ringClass =
    state === 'speaking' ? 'ring-gold' : state === 'listening' ? 'ring-gold/40' : 'ring-transparent';

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl border border-border bg-card px-10 py-14 shadow-sm">
      <div
        className={`flex h-28 w-28 items-center justify-center rounded-full bg-background ring-4 transition-all ${ringClass}`}
      >
        <LogoMark className="h-14 w-14" />
      </div>
      <div className="text-center">
        <p className="font-serif text-lg font-semibold text-ink">Your AI Tutor</p>
        <p className="text-sm text-ink/60">{label}</p>
      </div>
      <div
        style={{ '--lk-fg': 'var(--color-gold)', '--lk-va-bg': 'var(--color-border)' } as React.CSSProperties}
        className="w-3/5"
      >
        <BarVisualizer state={state as never} track={audioTrack} barCount={7} style={{ height: 64 }} />
      </div>
    </div>
  );
}

function LearnerTile({
  learner,
  cameraTrack,
  micOn,
  handRaised,
}: {
  learner: Learner;
  cameraTrack: TrackReference | undefined;
  micOn: boolean;
  handRaised: boolean;
}) {
  const initial = learner.firstName.charAt(0).toUpperCase();

  return (
    <div className="absolute bottom-8 right-8 flex h-32 w-44 flex-col overflow-hidden rounded-xl border border-border bg-ink shadow-sm">
      {cameraTrack ? (
        <VideoTrack trackRef={cameraTrack} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-card">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-sm font-semibold text-ink">
            {initial}
          </span>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1">
        {handRaised && <span title="Hand raised">✋</span>}
        <span className="text-xs font-medium text-white">{learner.firstName}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${micOn ? 'bg-gold' : 'bg-white/40'}`} title={micOn ? 'Mic on' : 'Muted'} />
      </div>
    </div>
  );
}
