import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

// Mints a room-join token for the live tutoring session. This is a server
// Route Handler so LIVEKIT_API_SECRET never reaches the client.
//
// TODO(Phase 2): once auth exists, derive `identity` from the authenticated
// platform_users row instead of accepting it from the client, and validate
// the learner is actually allowed into `room` (their own scheduled session).
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

  return NextResponse.json({ token: await token.toJwt(), serverUrl, room, identity });
}
