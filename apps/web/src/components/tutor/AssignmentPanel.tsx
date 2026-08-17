'use client';

import { LearnerGate } from '@/components/learner/LearnerGate';
import { MonacoAssignment } from './MonacoAssignment';

// Thin client wrapper so the Server Component page can pass plain serializable
// props across the RSC boundary — a Server Component can't pass a render-prop
// function directly into a Client Component like LearnerGate.
export function AssignmentPanel({ assignmentId, starterCode }: { assignmentId: string; starterCode: string }) {
  return (
    <LearnerGate>
      {(learner) => <MonacoAssignment learnerId={learner.id} assignmentId={assignmentId} starterCode={starterCode} />}
    </LearnerGate>
  );
}
