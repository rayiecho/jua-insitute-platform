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

export function MonacoAssignment({ learnerId, assignmentId, starterCode }: MonacoAssignmentProps) {
  const [code, setCode] = useState(starterCode);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load any code the learner already had in progress for this assignment.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/progress?learnerId=${encodeURIComponent(learnerId)}&assignmentId=${encodeURIComponent(assignmentId)}`)
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

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        const res = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learnerId, assignmentId, code: next }),
        });
        setStatus(res.ok ? 'saved' : 'error');
      } catch {
        setStatus('error');
      }
    }, DEBOUNCE_MS);
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
    <div className="flex h-full flex-col overflow-hidden rounded border border-gray-300">
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
  );
}
