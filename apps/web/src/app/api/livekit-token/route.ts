import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

const AGENT_NAME = 'ai-tutor'; // must match ServerOptions.agentName in apps/agent/src/index.ts

// Mints a room-join token for the live tutoring session. This is a server
// Route Handler so LIVEKIT_API_SECRET never reaches the client.
//
// The agent worker registers under a named agent (`ai-tutor`), which means
// LiveKit will NOT auto-dispatch it into a room just because a participant
// joined — an explicit dispatch is required. We create one here (idempotent:
// skipped if a dispatch already exists for this room) so joining the room
// from the web client actually gets you a tutor.
//
// TODO(Phase 2): once auth exists, derive `identity` from the authenticated
// platform_users row instead of accepting it from the client, and validate
// the learner is actually allowed into `room` (their own scheduled session).
// At that point dispatch creation likely moves to the booking flow instead
// of happening lazily here.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get('room');
  const identity = searchParams.get('identity');

  if (!room || !identity) {
    return NextResponse.json({ error: 'room and identity query params are required' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json({ error: 'LiveKit server env vars are not configured' }, { status: 500 });
  }

  const token = new AccessToken(apiKey, apiSecret, { identity, ttl: '15m' });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

  // listDispatch 404s if the room doesn't exist yet (rooms are otherwise only
  // created implicitly when the first participant joins) — createRoom is a
  // no-op against an already-existing room, so this is safe to call every time.
  const roomServiceClient = new RoomServiceClient(serverUrl, apiKey, apiSecret);
  await roomServiceClient.createRoom({ name: room });

  const dispatchClient = new AgentDispatchClient(serverUrl, apiKey, apiSecret);
  const existingDispatches = await dispatchClient.listDispatch(room);
  if (!existingDispatches.some((d) => d.agentName === AGENT_NAME)) {
    await dispatchClient.createDispatch(room, AGENT_NAME, { metadata: identity });
  }

  return NextResponse.json({ token: await token.toJwt(), serverUrl, room, identity });
}
