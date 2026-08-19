'use client';

import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 1750; // matches MonacoAssignment's autosave cadence

interface TextAssignmentProps {
  learnerId: string;
  assignmentId: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface GradeResult {
  gradingStatus: 'graded';
  score: number;
  rawError: string | null;
  feedback: string | null;
}

// The written-submission counterpart to MonacoAssignment — every
// Entrepreneurship exercise (Business Model Canvas, MVP plan, pitch draft,
// and so on) is graded on real thinking, not code, so this is a plain
// autosaving textarea instead of a code editor, wired to the same
// /api/progress and /api/grade endpoints (which branch on whether the
// assignment has a unit_test_suite_code — see api/grade/route.ts).
export function TextAssignment({ learnerId, assignmentId }: TextAssignmentProps) {
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/progress?assignmentId=${encodeURIComponent(assignmentId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.currentCodeState) setResponse(data.currentCodeState);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, assignmentId]);

  function handleChange(value: string) {
    setResponse(value);
    setStatus('idle');
    setGrade(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, code: value }),
        });
        setStatus(res.ok ? 'saved' : 'error');
      } catch {
        setStatus('error');
      }
    }, DEBOUNCE_MS);
  }

  async function handleSubmitForGrading() {
    setGrading(true);
    setGrade(null);
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, textResponse: response }),
      });
      const data = await res.json();
      if (res.ok) setGrade(data);
    } finally {
      setGrading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const statusLabel: Record<SaveStatus, string> = {
    idle: '',
    saving: 'Saving…',
    saved: 'Saved ✓',
    error: 'Failed to save',
  };

  if (!loaded) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-border bg-card">
        <p className="text-sm text-ink/40">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2 text-xs text-ink/50">
          <span>Your submission</span>
          <span className={status === 'error' ? 'text-red-600' : ''}>{statusLabel[status]}</span>
        </div>
        <textarea
          value={response}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Write your response here…"
          className="min-h-[300px] w-full resize-y bg-card p-4 text-sm leading-relaxed text-ink outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmitForGrading}
        disabled={grading || !response.trim()}
        className="rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-gold-dark disabled:opacity-50"
      >
        {grading ? 'Reviewing…' : 'Submit for review'}
      </button>

      {grade && (
        <div className="rounded-xl border border-gold bg-gold/10 p-4 text-sm">
          <p className="font-serif text-base font-semibold text-ink">Score: {grade.score}</p>
          {grade.feedback && <p className="mt-1.5 whitespace-pre-wrap text-ink/80">{grade.feedback}</p>}
        </div>
      )}
    </div>
  );
}
