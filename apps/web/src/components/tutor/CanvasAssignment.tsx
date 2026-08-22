'use client';

import { useEffect, useRef, useState } from 'react';
import { LessonHelpChat } from './LessonHelpChat';
import { type CanvasFieldDef, evaluateFormula, formatCanvasSubmission } from '@/lib/canvasFields';

const DEBOUNCE_MS = 1750; // matches MonacoAssignment/TextAssignment's autosave cadence

interface CanvasAssignmentProps {
  assignmentId: string;
  fields: CanvasFieldDef[];
  lessonTitle: string;
  instructions: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface GradeResult {
  gradingStatus: 'graded';
  score: number;
  rawError: string | null;
  feedback: string | null;
}

// The structured, hands-on counterpart to a blank textarea — a real Business
// Model Canvas, unit-economics calculator, or similar, with one labeled
// field per real concept instead of one big box of prose. Same autosave and
// grading plumbing as TextAssignment (see api/grade/route.ts's written-review
// path) — the field values are just formatted into readable text before
// being submitted, so no backend changes were needed to add this.
export function CanvasAssignment({ assignmentId, fields, lessonTitle, instructions }: CanvasAssignmentProps) {
  const [values, setValues] = useState<Record<string, string>>({});
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
        if (data.currentCodeState) {
          try {
            setValues(JSON.parse(data.currentCodeState));
          } catch {
            // pre-existing plain-text save from before this was a canvas — ignore, start fresh
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  function handleChange(key: string, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    setStatus('idle');
    setGrade(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, code: JSON.stringify(next) }),
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
      const textResponse = formatCanvasSubmission(fields, values);
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, textResponse }),
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

  const hasAnyValue = Object.values(values).some((v) => v?.trim());

  if (!loaded) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-border bg-card">
        <p className="text-sm text-ink/40">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1 text-xs text-ink/50">
        <span>Your canvas</span>
        <span className={status === 'error' ? 'text-red-600' : ''}>{statusLabel[status]}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <CanvasField key={field.key} field={field} value={values[field.key] ?? ''} allValues={values} onChange={handleChange} />
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmitForGrading}
        disabled={grading || !hasAnyValue}
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

      <LessonHelpChat
        autoOpen={grade != null && grade.score < 70}
        context={{
          lessonTitle,
          assignmentInstructions: instructions,
          studentSubmission: formatCanvasSubmission(fields, values),
          feedback: grade?.feedback ?? undefined,
        }}
      />
    </div>
  );
}

function CanvasField({
  field,
  value,
  allValues,
  onChange,
}: {
  field: CanvasFieldDef;
  value: string;
  allValues: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // A formula field is a live-computed, read-only result — not something the
  // learner types into directly (e.g. "Margin ($)" derived from Price - Cost).
  if (field.type === 'number' && field.formula) {
    const computed = evaluateFormula(field.formula, allValues);
    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-gold/40 bg-gold/5 shadow-sm">
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold-dark">{field.label}</div>
        <div className="px-4 py-3 font-serif text-2xl font-semibold text-ink">
          {computed === null ? '—' : computed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="border-b border-border bg-background px-4 py-2 text-xs font-medium text-ink/60">{field.label}</div>
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="min-h-[110px] w-full resize-y bg-card p-3 text-sm leading-relaxed text-ink outline-none"
        />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-card p-3 text-sm text-ink outline-none"
        />
      )}
    </div>
  );
}
