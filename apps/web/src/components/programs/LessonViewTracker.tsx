'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getLearnerServerSnapshot, getLearnerSnapshot, subscribeLearner } from '@/lib/learner';

// Invisible — just reports "this learner is looking at this lesson" so the
// tutor's continuity lookup (Section 4.4) has a last-viewed-node fallback for
// learners who are reading, not yet mid-assignment. Anonymous visitors (no
// learner in localStorage yet) are simply not tracked; nothing to enroll.
export function LessonViewTracker({ courseId, nodeId }: { courseId: string; nodeId: string }) {
  const learner = useSyncExternalStore(subscribeLearner, getLearnerSnapshot, getLearnerServerSnapshot);

  useEffect(() => {
    if (!learner) return;
    fetch('/api/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: learner.id, courseId, nodeId }),
    }).catch(() => {
      // Best-effort — a missed view-tracking call just means slightly stale
      // continuity next session, not a broken one.
    });
  }, [learner, courseId, nodeId]);

  return null;
}
