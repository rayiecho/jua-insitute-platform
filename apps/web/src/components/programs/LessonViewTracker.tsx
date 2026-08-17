'use client';

import { useEffect } from 'react';
import { useLearnerSession } from '@/lib/learner';

// Invisible — just reports "this learner is looking at this lesson" so the
// tutor's continuity lookup (Section 4.4) has a last-viewed-node fallback for
// learners who are reading, not yet mid-assignment. Anonymous/not-signed-in
// visitors are simply not tracked; nothing to enroll.
export function LessonViewTracker({ courseId, nodeId }: { courseId: string; nodeId: string }) {
  const { learner } = useLearnerSession();

  useEffect(() => {
    if (!learner) return;
    fetch('/api/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, nodeId }),
    }).catch(() => {
      // Best-effort — a missed view-tracking call just means slightly stale
      // continuity next session, not a broken one.
    });
  }, [learner, courseId, nodeId]);

  return null;
}
