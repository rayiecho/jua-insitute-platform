'use client';

import { TutorLobby } from '@/components/tutor/TutorLobby';

// One persistent room per learner (Section 4.4 — the agent's continuity
// logic figures out what they're working on from their platform_users row,
// so the room itself doesn't need to encode which course/lesson sent them
// here). This is the single entry point every "Talk to your tutor" link
// points at. TutorLobby owns the identify → ready → join ritual and only
// mounts the actual LiveKit connection once the learner clicks Join.
export default function TutorPage() {
  return <TutorLobby />;
}
