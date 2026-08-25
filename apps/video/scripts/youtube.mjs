import { getEnvVar } from './env.mjs';

// Raw REST calls against YouTube Data API v3's resumable upload, rather
// than pulling in the full `googleapis` package for one operation.
//
// Refresh tokens from an unverified/"Testing" OAuth app expire after ~7
// days (a real, current Google constraint, confirmed 2026-08-25) — this
// will need re-authorizing periodically until the app is published/
// verified. Not worth blocking on that process now.
async function getAccessToken() {
  const clientId = getEnvVar('YOUTUBE_CLIENT_ID');
  const clientSecret = getEnvVar('YOUTUBE_CLIENT_SECRET');
  const refreshToken = getEnvVar('YOUTUBE_REFRESH_TOKEN');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token;
}

/**
 * Uploads a video buffer to YouTube via the resumable upload protocol:
 * 1. POST metadata to get a resumable session URL (in the Location header).
 * 2. PUT the actual video bytes to that URL.
 */
export async function uploadToYouTube({ videoBuffer, title, description }) {
  const accessToken = await getAccessToken();

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBuffer.length),
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          categoryId: '27', // Education
        },
        status: {
          privacyStatus: 'unlisted', // Deliberately unlisted, not public — a human should review/publish each upload, not auto-publish to the channel.
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  );
  if (!initRes.ok) {
    throw new Error(`YouTube upload init failed: ${initRes.status} ${await initRes.text()}`);
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube upload init returned no session URL');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(videoBuffer.length) },
    body: videoBuffer,
  });
  const data = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`YouTube upload failed: ${uploadRes.status} ${JSON.stringify(data)}`);
  }
  return `https://www.youtube.com/watch?v=${data.id}`;
}
