'use client';

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { LessonHelpChat } from './LessonHelpChat';

const DEBOUNCE_MS = 1750; // matches the agent's shared-focus debounce (Section 4.1, Section 7)

interface MonacoAssignmentProps {
  learnerId: string;
  assignmentId: string;
  starterCode: string;
  lessonTitle: string;
  instructions: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface GradeResult {
  gradingStatus: 'needs_revision' | 'graded';
  score: number;
  rawError: string | null;
  feedback: string | null;
}

export function MonacoAssignment({ learnerId, assignmentId, starterCode, lessonTitle, instructions }: MonacoAssignmentProps) {
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
    saved: 'Saved ✓',
    error: 'Failed to save',
  };

  if (!loaded) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border border-border bg-card xl:h-full">
        <p className="text-sm text-ink/40">Loading editor…</p>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] flex-col gap-3 xl:h-full">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between border-b border-ink/10 bg-[#1e1e1e] px-4 py-2 text-xs text-white/60">
          <span className="flex items-center gap-2 font-mono">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            <span className="ml-1">assignment.py</span>
          </span>
          <span className={status === 'error' ? 'text-red-400' : 'text-white/40'}>{statusLabel[status]}</span>
        </div>
        <div className="flex-1">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={handleChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 22,
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              fontFamily: 'var(--font-mono), Menlo, Consolas, monospace',
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmitForGrading}
        disabled={grading}
        className="rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-gold-dark disabled:opacity-50"
      >
        {grading ? 'Running your code…' : 'Submit for grading'}
      </button>

      {grade && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            grade.gradingStatus === 'needs_revision' ? 'border-red-300 bg-red-50' : 'border-gold bg-gold/10'
          }`}
        >
          <p className="font-serif text-base font-semibold text-ink">
            {grade.gradingStatus === 'needs_revision' ? "Doesn't run yet" : `Score: ${grade.score}`}
          </p>
          {grade.feedback && <p className="mt-1.5 whitespace-pre-wrap text-ink/80">{grade.feedback}</p>}
          {grade.rawError && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-[#1e1e1e] p-3 text-xs text-white/90">{grade.rawError}</pre>
          )}
        </div>
      )}

      <LessonHelpChat
        autoOpen={grade != null && (grade.gradingStatus === 'needs_revision' || grade.score < 70)}
        context={{
          lessonTitle,
          assignmentInstructions: instructions,
          studentSubmission: code,
          feedback: grade?.feedback ?? grade?.rawError ?? undefined,
        }}
      />
    </div>
  );
}
