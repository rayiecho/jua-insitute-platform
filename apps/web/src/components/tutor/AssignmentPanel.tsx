'use client';

import { LearnerGate } from '@/components/learner/LearnerGate';
import { MonacoAssignment } from './MonacoAssignment';
import { TextAssignment } from './TextAssignment';
import { CanvasAssignment } from './CanvasAssignment';
import { parseCanvasFields } from '@/lib/canvasFields';

// Thin client wrapper so the Server Component page can pass plain serializable
// props across the RSC boundary — a Server Component can't pass a render-prop
// function directly into a Client Component like LearnerGate. Routes to one
// of three assignment types:
//   - the code editor, when the assignment has a unit_test_suite_code
//   - a structured "canvas" (Business Model Canvas, a unit-economics
//     calculator, etc.), when instructions_markdown contains a ```canvas
//     field-definition block (see lib/canvasFields.ts — deliberately
//     schema-free, no course_assignments migration needed)
//   - a plain written-submission textarea otherwise
// See api/grade/route.ts for the matching grading branch — canvas and plain
// text both submit as textResponse and share the same written-review path.
export function AssignmentPanel({
  assignmentId,
  starterCode,
  isCodeAssignment,
  lessonTitle,
  instructions,
}: {
  assignmentId: string;
  starterCode: string;
  isCodeAssignment: boolean;
  lessonTitle: string;
  instructions: string;
}) {
  const canvas = !isCodeAssignment ? parseCanvasFields(instructions) : null;

  return (
    <LearnerGate>
      {(learner) =>
        isCodeAssignment ? (
          <MonacoAssignment
            learnerId={learner.id}
            assignmentId={assignmentId}
            starterCode={starterCode}
            lessonTitle={lessonTitle}
            instructions={instructions}
          />
        ) : canvas ? (
          <CanvasAssignment
            assignmentId={assignmentId}
            fields={canvas.fields}
            lessonTitle={lessonTitle}
            instructions={canvas.cleanedInstructions}
          />
        ) : (
          <TextAssignment
            learnerId={learner.id}
            assignmentId={assignmentId}
            lessonTitle={lessonTitle}
            instructions={instructions}
          />
        )
      }
    </LearnerGate>
  );
}
