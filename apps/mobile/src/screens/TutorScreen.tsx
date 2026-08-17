import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AndroidAudioTypePresets,
  AudioSession,
  LiveKitRoom,
  registerGlobals,
} from '@livekit/react-native';
import { useConnectionState, useLocalParticipant, useVoiceAssistant } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { apiFetch } from '../lib/api';
import type { Learner } from '../lib/learner';

// registerGlobals() wires WebRTC's globals (RTCPeerConnection, mediaDevices,
// etc.) into the RN JS runtime — required once, before any LiveKit usage.
registerGlobals();

interface TokenResponse {
  token: string;
  serverUrl: string;
  room: string;
}

export function TutorScreen({ learner }: { learner: Learner }) {
  const [tokenInfo, setTokenInfo] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Section 4.5 — set up the iOS/Android audio session as an active voice
    // call (not media playback) before connecting, so background audio mode
    // (UIBackgroundModes: audio) actually keeps the mic/speaker alive.
    AudioSession.configureAudio({
      ios: { defaultOutput: 'speaker' },
      android: { audioTypeOptions: AndroidAudioTypePresets.communication },
    })
      .then(() => AudioSession.setAppleAudioConfiguration({
        audioCategory: 'playAndRecord',
        audioMode: 'voiceChat',
        audioCategoryOptions: ['allowBluetooth', 'defaultToSpeaker'],
      }))
      .then(() => AudioSession.startAudioSession())
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to start audio session'));

    // Same room-naming convention as the web tutor (Section 4.4 continuity
    // is keyed off this) — one persistent room per learner, whichever
    // client they join from.
    const room = `learner-${learner.id}`;
    apiFetch(`/api/livekit-token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(learner.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setTokenInfo(data);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to connect'));

    return () => {
      cancelled = true;
      void AudioSession.stopAudioSession();
    };
  }, [learner.id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!tokenInfo) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Connecting to your tutor…</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom serverUrl={tokenInfo.serverUrl} token={tokenInfo.token} connect audio>
      <TutorRoomBody />
    </LiveKitRoom>
  );
}

function TutorRoomBody() {
  const connectionState = useConnectionState();
  const { state: agentState } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  if (connectionState !== ConnectionState.Connected) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Joining the room…</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.status}>{describeAgentState(agentState)}</Text>
      <Pressable
        onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        style={[styles.micButton, !isMicrophoneEnabled && styles.micButtonMuted]}
      >
        <Text style={styles.micButtonText}>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</Text>
      </Pressable>
    </View>
  );
}

function describeAgentState(state: string): string {
  switch (state) {
    case 'listening':
      return 'Listening…';
    case 'thinking':
      return 'Thinking…';
    case 'speaking':
      return 'Speaking…';
    case 'connecting':
      return 'Connecting to your tutor…';
    default:
      return 'Your tutor is here';
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  hint: { color: '#8b6f47' },
  error: { color: '#b91c1c', padding: 24, textAlign: 'center' },
  status: { fontSize: 18, fontWeight: '600', color: '#141414' },
  micButton: { backgroundColor: '#C8862B', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999 },
  micButtonMuted: { backgroundColor: '#8b6f47' },
  micButtonText: { color: '#141414', fontWeight: '700', fontSize: 16 },
});
