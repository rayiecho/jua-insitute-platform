'use client';

import { BarVisualizer, DisconnectButton, useVoiceAssistant, useLocalParticipant } from '@livekit/components-react';

const AGENT_STATE_LABEL: Record<string, string> = {
  disconnected: 'Waiting to connect…',
  connecting: 'Connecting…',
  initializing: 'Getting ready…',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
};

// Phase 1 UI per Section 1 of the spec: voice + reactive waveform, no avatar.
export function TutorSessionUI() {
  const { state, audioTrack } = useVoiceAssistant();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6">
      <p className="text-sm text-gray-500">{AGENT_STATE_LABEL[state] ?? state}</p>

      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        barCount={7}
        style={{ width: '100%', height: 120 }}
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          className="rounded border border-gray-300 px-4 py-2"
        >
          {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        </button>
        <DisconnectButton className="rounded bg-red-600 px-4 py-2 text-white">Leave</DisconnectButton>
      </div>
    </main>
  );
}
