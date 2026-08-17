'use client';

import {
  BarVisualizer,
  DisconnectButton,
  StartAudio,
  useVoiceAssistant,
  useLocalParticipant,
} from '@livekit/components-react';
import { LogoMark } from '@/components/brand/Logo';
import type { Learner } from '@/lib/learner';

const AGENT_STATE_LABEL: Record<string, string> = {
  disconnected: 'Waiting to connect…',
  connecting: 'Connecting…',
  initializing: 'Getting ready…',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
};

// The live classroom (Section 1: "The Live Class Layer"). Laid out like a
// real meeting room — a tutor "stage" tile and a learner tile — so the room
// this photorealistic-avatar-and-vision work eventually slots into already
// exists and looks intentional today, not like a placeholder waiting for a
// feature. Presence is voice + waveform for now (Phase 1 scope); the Camera
// control is visibly reserved, not hidden, so its arrival later isn't a
// layout change.
export function TutorSessionUI({ learner }: { learner: Learner }) {
  const { state, audioTrack } = useVoiceAssistant();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  const stateLabel = AGENT_STATE_LABEL[state] ?? state;
  const isLive = state === 'listening' || state === 'thinking' || state === 'speaking';

  return (
    <main className="flex min-h-screen flex-col bg-background">
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

      <div className="relative flex flex-1 items-center justify-center p-6">
        <TutorTile state={state} audioTrack={audioTrack} label={stateLabel} />
        <LearnerTile learner={learner} micOn={isMicrophoneEnabled} />
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border px-6 py-5">
        <StartAudio
          label="Click to enable audio"
          className="rounded bg-gold px-4 py-2 text-sm font-semibold text-ink"
        />
        <button
          type="button"
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
            isMicrophoneEnabled ? 'border-border text-ink hover:bg-card' : 'border-red-300 bg-red-50 text-red-600'
          }`}
        >
          {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button
          type="button"
          disabled
          title="Video is coming soon"
          className="cursor-not-allowed rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink/30"
        >
          Camera
        </button>
        <DisconnectButton className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
          Leave
        </DisconnectButton>
      </div>
    </main>
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

function LearnerTile({ learner, micOn }: { learner: Learner; micOn: boolean }) {
  const initial = learner.firstName.charAt(0).toUpperCase();
  return (
    <div className="absolute bottom-8 right-8 flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-xs font-semibold text-ink">
        {initial}
      </span>
      <span className="text-sm font-medium text-ink">{learner.firstName}</span>
      <span className={`h-2 w-2 rounded-full ${micOn ? 'bg-gold' : 'bg-border'}`} title={micOn ? 'Mic on' : 'Muted'} />
    </div>
  );
}
