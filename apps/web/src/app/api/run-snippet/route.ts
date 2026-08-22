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
  // A generous but real cap — this is meant for short illustrative
  // snippets, not full programs, and keeps the sandbox call itself cheap.
  if (code.length > 4000) {
    return NextResponse.json({ error: 'Snippet is too long for the inline runner' }, { status: 400 });
  }

  try {
    const result = await runPython(code);
    return NextResponse.json({ output: result.output, exitedCleanly: result.exitedCleanly });
  } catch {
    return NextResponse.json({ error: 'The sandbox is unavailable right now — try again shortly.' }, { status: 502 });
  }
}
