'use client';

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';

const DEBOUNCE_MS = 1750; // matches the agent's shared-focus debounce (Section 4.1, Section 7)

interface MonacoAssignmentProps {
  learnerId: string;
  assignmentId: string;
  starterCode: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface GradeResult {
  gradingStatus: 'needs_revision' | 'graded';
  score: number;
  rawError: string | null;
  feedback: string | null;
}

export function MonacoAssignment({ learnerId, assignmentId, starterCode }: MonacoAssignmentProps) {
  const [code, setCode] = useState(starterCode);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load any code the learner already had in progress for this assignment.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/progress?assignmentId=${encodeURIComponent(assignmentId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.currentCodeState) setCode(data.currentCodeState);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, assignmentId]);

  function handleChange(value: string | undefined) {
    const next = value ?? '';
    setCode(next);
    setStatus('idle');
    setGrade(null); // stale once the code changes again

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, code: next }),
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
        body: JSON.stringify({ assignmentId, code }),
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
    saved: 'Saved',
    error: 'Failed to save',
  };

  if (!loaded) return null;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-1 flex-col overflow-hidden rounded border border-gray-300">
        <div className="flex items-center justify-between border-b border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
          <span>assignment.py</span>
          <span>{statusLabel[status]}</span>
        </div>
        <div className="flex-1">
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            onChange={handleChange}
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmitForGrading}
        disabled={grading}
        className="rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {grading ? 'Running…' : 'Submit for grading'}
      </button>

      {grade && (
        <div
          className={`rounded border p-3 text-sm ${
            grade.gradingStatus === 'needs_revision' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
          }`}
        >
          <p className="font-semibold">
            {grade.gradingStatus === 'needs_revision' ? "Doesn't run yet" : `Score: ${grade.score}`}
          </p>
          {grade.feedback && <p className="mt-1 whitespace-pre-wrap">{grade.feedback}</p>}
          {grade.rawError && (
            <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-50">{grade.rawError}</pre>
          )}
        </div>
      )}
    </div>
  );
}
