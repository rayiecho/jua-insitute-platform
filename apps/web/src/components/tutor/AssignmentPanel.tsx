'use client';

import { LearnerGate } from '@/components/learner/LearnerGate';
import { MonacoAssignment } from './MonacoAssignment';
import { TextAssignment } from './TextAssignment';

// Thin client wrapper so the Server Component page can pass plain serializable
// props across the RSC boundary — a Server Component can't pass a render-prop
// function directly into a Client Component like LearnerGate. Routes to the
// code editor or a plain written-submission textarea depending on whether
// the assignment has a unit_test_suite_code — see api/grade/route.ts for the
// matching branch on the grading side.
export function AssignmentPanel({
  assignmentId,
  starterCode,
  isCodeAssignment,
}: {
  assignmentId: string;
  starterCode: string;
  isCodeAssignment: boolean;
}) {
  return (
    <LearnerGate>
      {(learner) =>
        isCodeAssignment ? (
          <MonacoAssignment learnerId={learner.id} assignmentId={assignmentId} starterCode={starterCode} />
        ) : (
          <TextAssignment learnerId={learner.id} assignmentId={assignmentId} />
        )
      }
    </LearnerGate>
  );
}
