'use client';

import { useState } from 'react';
import { ParticipantKind, Track } from 'livekit-client';
import type { TrackReference } from '@livekit/components-core';
import {
  BarVisualizer,
  DisconnectButton,
  StartAudio,
  VideoTrack,
  useChat,
  useDataChannel,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { LogoMark } from '@/components/brand/Logo';
import { ClassroomShell } from './ClassroomShell';
import { SessionGuidePanel } from './SessionGuidePanel';
import { ChatPanel } from './ChatPanel';
import { TeachingScreen, useTeachingScreen } from './TeachingScreen';
import type { Learner } from '@/lib/learner';

const AGENT_STATE_LABEL: Record<string, string> = {
  disconnected: 'Your tutor will let you in shortly…',
  connecting: 'Your tutor will let you in shortly…',
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
  const [chatOpen, setChatOpen] = useState(false);
  const { chatMessages } = useChat();
  const [lastSeenChatCount, setLastSeenChatCount] = useState(0);
  const unreadChat = chatOpen ? 0 : chatMessages.length - lastSeenChatCount;
  const [handRaised, setHandRaised] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks[0];
  // The Simli avatar (apps/agent/src/simli-avatar.ts) publishes real video
  // into the room as its own participant once SIMLI_FACE_ID is set.
  // useTracks() only returns tracks matching the requested source list —
  // Simli's actual publish source was never confirmed (their docs don't
  // say), so this is widened to every known video source rather than
  // assuming Camera specifically. Restricted to kind !== STANDARD so a
  // fellow LEARNER's camera (a real human, kind STANDARD) can never be
  // mistaken for the tutor's video — confirmed live 2026-08-19 in a
  // two-learner group class: the second learner's own camera was being
  // rendered full-stage as if it were the tutor, and there was no separate
  // tile for them at all, which is exactly backwards.
  const videoTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown]);
  const avatarVideoTrack = videoTracks.find(
    (t) =>
      !t.participant.isLocal &&
      t.source !== Track.Source.ScreenShare &&
      t.participant.kind !== ParticipantKind.STANDARD,
  );
  const localCameraTrack = videoTracks.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);

  // Every other real human in the room — classmates in a scheduled group
  // class. Each gets the same small corner tile the learner's own camera
  // gets, so "who's here" is actually visible, not just "me and the tutor."
  const remoteParticipants = useRemoteParticipants();
  const otherLearners = remoteParticipants.filter((p) => p.kind === ParticipantKind.STANDARD);
  const cameraTracksByIdentity = new Map(
    videoTracks.filter((t) => t.source === Track.Source.Camera).map((t) => [t.participant.identity, t]),
  );

  const teachingScreen = useTeachingScreen();
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
        <div className="flex items-center justify-between border-b border-border px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2 text-sm text-ink/60">
            <LogoMark className="h-5 w-5" />
            <span>Live class</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
            <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-gold' : 'bg-border'}`} />
            {stateLabel}
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-6">
          {screenShareTrack ? (
            <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-ink shadow-sm">
              <VideoTrack trackRef={screenShareTrack} className="h-full w-full" />
            </div>
          ) : teachingScreen ? (
            <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-border shadow-sm">
              <TeachingScreen screen={teachingScreen} />
            </div>
          ) : avatarVideoTrack ? (
            <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-ink shadow-sm">
              <VideoTrack trackRef={avatarVideoTrack} className="h-full w-full object-cover" />
            </div>
          ) : (
            <TutorTile state={state} audioTrack={audioTrack} label={stateLabel} />
          )}

          {/* Whenever something else (screen share, teaching screen, or the
              avatar video) takes over the main stage, the tutor's own
              presence still needs a visible spot, the same way the
              learner's camera keeps a corner tile — otherwise there's
              nothing showing where the tutor "is" at all. */}
          {(screenShareTrack || teachingScreen || avatarVideoTrack) && (
            <TutorPipTile state={state} label={stateLabel} />
          )}

          <LearnerTile learner={learner} cameraTrack={localCameraTrack} micOn={isMicrophoneEnabled} handRaised={handRaised} />

          {/* Classmates in a scheduled group class — stacked up the right
              edge, above the learner's own tile, so a group class actually
              shows who's here instead of just "me and the tutor." */}
          <div className="absolute bottom-24 right-3 flex flex-col-reverse gap-2 sm:bottom-40 sm:right-8">
            {otherLearners.map((p) => (
              <RemoteLearnerTile key={p.identity} name={p.name || 'Classmate'} cameraTrack={cameraTracksByIdentity.get(p.identity)} />
            ))}
          </div>

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

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border px-3 py-4 sm:px-6 sm:py-5">
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
            onClick={() => {
              setChatOpen(false);
              setGuideOpen((v) => !v);
            }}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              guideOpen ? 'border-gold bg-gold/10 text-gold-dark' : 'border-border text-ink hover:bg-card'
            }`}
          >
            Guide
          </button>

          <button
            type="button"
            onClick={() => {
              setGuideOpen(false);
              setChatOpen((v) => {
                const next = !v;
                if (next) setLastSeenChatCount(chatMessages.length);
                return next;
              });
            }}
            className={`relative rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              chatOpen ? 'border-gold bg-gold/10 text-gold-dark' : 'border-border text-ink hover:bg-card'
            }`}
          >
            Chat
            {unreadChat > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-ink">
                {unreadChat}
              </span>
            )}
          </button>

          <DisconnectButton className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
            Leave
          </DisconnectButton>
        </div>
      </main>

      <SessionGuidePanel learnerId={learner.id} open={guideOpen} onClose={() => setGuideOpen(false)} />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
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
    <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl border border-border bg-card px-6 py-10 shadow-sm sm:px-10 sm:py-14">
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

function TutorPipTile({ state, label }: { state: string; label: string }) {
  const isSpeaking = state === 'speaking';
  return (
    <div className="absolute bottom-3 left-3 flex h-20 w-28 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:bottom-8 sm:left-8 sm:h-32 sm:w-44">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-background ring-2 transition-all sm:h-14 sm:w-14 ${
          isSpeaking ? 'ring-gold' : state === 'listening' ? 'ring-gold/40' : 'ring-transparent'
        }`}
      >
        <LogoMark className="h-5 w-5 sm:h-8 sm:w-8" />
      </div>
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1">
        {isSpeaking && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />}
        <span className="text-xs font-medium text-white">Tutor</span>
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
    <div className="absolute bottom-3 right-3 flex h-20 w-28 flex-col overflow-hidden rounded-xl border border-border bg-ink shadow-sm sm:bottom-8 sm:right-8 sm:h-32 sm:w-44">
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

function RemoteLearnerTile({ name, cameraTrack }: { name: string; cameraTrack: TrackReference | undefined }) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative flex h-16 w-24 flex-col overflow-hidden rounded-xl border border-border bg-ink shadow-sm sm:h-24 sm:w-36">
      {cameraTrack ? (
        <VideoTrack trackRef={cameraTrack} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-card">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tan text-xs font-semibold text-ink sm:h-10 sm:w-10">
            {initial}
          </span>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/50 px-2 py-1">
        <span className="text-xs font-medium text-white">{name}</span>
      </div>
    </div>
  );
}
