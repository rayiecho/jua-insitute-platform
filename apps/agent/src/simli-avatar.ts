import { getJobContext, voice } from '@livekit/agents';
import type { AgentSession } from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';

// No official @livekit/agents-plugin-simli exists for Node — Simli only
// ships a Python plugin (livekit-plugins-simli). This is a direct port of
// that plugin's actual logic (read from its real source,
// github.com/livekit/agents, 2026-08-18) onto the Node SDK's own
// voice.AvatarSession base class, which turns out to already exist here —
// confirmed by inspecting @livekit/agents-plugin-bey's compiled source,
// which follows the identical two-call pattern: mint a LiveKit token for a
// dedicated avatar participant, tell the provider's own server to join the
// room with it, then route TTS audio to that participant over a LiveKit
// DataStream. Simli's servers join and publish the avatar's video track
// themselves — nothing here does raw WebRTC or frame relaying locally.
const ATTRIBUTE_PUBLISH_ON_BEHALF = 'lk.publish_on_behalf';
const AVATAR_AGENT_IDENTITY = 'simli-avatar-agent';
const AVATAR_AGENT_NAME = 'simli-avatar-agent';
const DEFAULT_API_URL = 'https://api.simli.ai';
const SAMPLE_RATE = 16000;

export class SimliException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimliException';
  }
}

export interface SimliAvatarOptions {
  apiKey?: string;
  faceId: string;
  emotionId?: string;
  // Simli's own default is 600s (10 min) — far short of our 45-minute live
  // classes (see index.ts), so this MUST be set explicitly per session or
  // Simli disconnects the avatar mid-class regardless of what's happening.
  maxSessionLengthSeconds: number;
  // Simli's default is 30s of the avatar not speaking. Learner-heavy
  // stretches (the tutor asking a question and listening) can run longer
  // than that, so this defaults higher to avoid dropping the avatar for a
  // normal pause in a genuinely interactive class.
  maxIdleTimeSeconds?: number;
  apiUrl?: string;
}

export class SimliAvatarSession extends voice.AvatarSession {
  private readonly apiKey: string;
  private readonly faceId: string;
  private readonly emotionId: string;
  private readonly maxSessionLengthSeconds: number;
  private readonly maxIdleTimeSeconds: number;
  private readonly apiUrl: string;

  constructor(options: SimliAvatarOptions) {
    super();
    this.apiKey = options.apiKey || process.env.SIMLI_API_KEY || '';
    if (!this.apiKey) {
      throw new SimliException(
        'apiKey must be set either by passing apiKey or setting the SIMLI_API_KEY environment variable',
      );
    }
    this.faceId = options.faceId;
    this.emotionId = options.emotionId || '92f24a0c-f046-45df-8df0-af7449c04571'; // Simli's default "happy" emotion
    this.maxSessionLengthSeconds = options.maxSessionLengthSeconds;
    this.maxIdleTimeSeconds = options.maxIdleTimeSeconds ?? 120;
    this.apiUrl = options.apiUrl || DEFAULT_API_URL;
  }

  get avatarIdentity(): string {
    return AVATAR_AGENT_IDENTITY;
  }

  get provider(): string {
    return 'simli';
  }

  async start(agentSession: AgentSession, room: Room): Promise<void> {
    await super.start(agentSession, room);

    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new SimliException('LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set');
    }

    let localParticipantIdentity = '';
    try {
      const jobCtx = getJobContext();
      localParticipantIdentity = jobCtx.job.participant?.identity || room.localParticipant?.identity || '';
    } catch {
      localParticipantIdentity = room.localParticipant?.identity || '';
    }

    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: AVATAR_AGENT_IDENTITY,
      name: AVATAR_AGENT_NAME,
    });
    token.kind = 'agent';
    token.addGrant({ roomJoin: true, room: room.name });
    token.attributes = { [ATTRIBUTE_PUBLISH_ON_BEHALF]: localParticipantIdentity };
    const livekitToken = await token.toJwt();

    const tokenRes = await fetch(`${this.apiUrl}/compose/token`, {
      method: 'POST',
      headers: { 'x-simli-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        faceId: `${this.faceId}/${this.emotionId}`,
        handleSilence: true,
        maxSessionLength: this.maxSessionLengthSeconds,
        maxIdleTime: this.maxIdleTimeSeconds,
      }),
    });
    if (!tokenRes.ok) {
      throw new SimliException(`Simli /compose/token failed (${tokenRes.status}): ${await tokenRes.text()}`);
    }
    const { session_token: sessionToken } = (await tokenRes.json()) as { session_token: string };
    console.log('[simli] compose/token ok');

    const joinRes = await fetch(`${this.apiUrl}/integrations/livekit/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken, livekit_token: livekitToken, livekit_url: livekitUrl }),
    });
    const joinBody = await joinRes.text();
    if (!joinRes.ok) {
      throw new SimliException(`Simli LiveKit join failed (${joinRes.status}): ${joinBody}`);
    }
    console.log('[simli] integrations/livekit/agents response:', joinBody);

    agentSession.output.audio = new voice.DataStreamAudioOutput({
      room,
      destinationIdentity: AVATAR_AGENT_IDENTITY,
      sampleRate: SAMPLE_RATE,
    });
  }
}
