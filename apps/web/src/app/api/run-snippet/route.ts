import { NextResponse } from 'next/server';
import { runPython } from '@/lib/sandbox';

// Powers the inline "try it" runnable snippets embedded directly in reading
// lessons (see components/tutor/InlineCodeRun.tsx and the ```python-run
// fenced-block convention in lib/canvasFields-style markdown authoring) —
// distinct from /api/grade, which is tied to a real assignment record and
// writes a grade. This is pure exploration: run arbitrary short snippets,
// return the output, nothing persisted. No auth required, matching the
// public, no-signup nature of just reading a lesson.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code: string | undefined = body?.code;
  if (typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }
  // Also used by MonacoAssignment's "Run" terminal (full assignment-length
  // code, not just inline lesson snippets), so the cap has to cover a real
  // small program, not just a few illustrative lines.
  if (code.length > 20000) {
    return NextResponse.json({ error: 'Code is too long to run' }, { status: 400 });
  }

  try {
    const result = await runPython(code);
    return NextResponse.json({ output: result.output, exitedCleanly: result.exitedCleanly });
  } catch {
    return NextResponse.json({ error: 'The sandbox is unavailable right now — try again shortly.' }, { status: 502 });
  }
}
