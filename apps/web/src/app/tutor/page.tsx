'use client';

import { LearnerGate } from '@/components/learner/LearnerGate';
import { TutorSessionRoom } from '@/components/tutor/TutorSessionRoom';

// One persistent room per learner (Section 4.4 — the agent's continuity
// logic figures out what they're working on from their platform_users row,
// so the room itself doesn't need to encode which course/lesson sent them
// here). This is the single entry point every "Talk to your tutor" link
// points at, rather than each page trying to know the learner ahead of time.
export default function TutorPage() {
  return <LearnerGate>{(learner) => <TutorSessionRoom room={`learner-${learner.id}`} />}</LearnerGate>;
}
