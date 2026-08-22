'use client';

import { useState } from 'react';

// The "try it right here" snippet embedded directly inside reading lessons —
// authored as a fenced ```python-run block in lesson markdown_content (see
// the code override wired up in learn/[slug]/page.tsx). Deliberately a
// lightweight editable textarea, not a full Monaco instance — this is for
// quickly tweaking a value and seeing what changes while reading, not doing
// the graded work (that's MonacoAssignment, at the end of the week).
export function InlineCodeRun({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.replace(/\n$/, ''));
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/run-snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to run');
      setOutput(data.output || '(no output)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRunning(false);
    }
  }

  const lineCount = code.split('\n').length;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between bg-ink px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs font-medium text-white/40">Try it yourself — edit and run</span>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={Math.min(Math.max(lineCount, 3), 14)}
        className="w-full resize-y bg-ink px-4 py-3 font-mono text-sm leading-relaxed text-background outline-none"
      />
      <div className="flex items-center justify-between border-t border-white/10 bg-ink px-4 py-2">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded bg-gold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
        >
          {running ? 'Running…' : '▶ Run'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      {output !== null && (
        // Deliberately a <div>, not a <pre> — this component can render
        // inside the lesson article, which styles every descendant <pre>
        // for its OWN static code blocks (dark background); a nested <pre>
        // here would inherit that and invert unpredictably.
        <div className="border-t border-border bg-background px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">Output</p>
          <div className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-ink">{output}</div>
        </div>
      )}
    </div>
  );
}
