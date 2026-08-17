// Section 4.6 step 1 — "Compile/run the code in the Docker sandbox first, always."
//
// This project has no Docker infrastructure to stand up from this environment
// (no Docker available, and Supabase Edge Function deployment needs interactive
// CLI login we don't have). Wandbox (wandbox.org) is a real, public, no-signup
// sandboxed execution service — submissions run in isolated containers on their
// end — used here as a pragmatic stand-in. Swap for a self-hosted Docker sandbox
// / Supabase Edge Function once that infra exists; the interface below
// (`runPython`) is the seam to swap behind.

const WANDBOX_COMPILE_URL = 'https://wandbox.org/api/compile.json';
const PYTHON_COMPILER = 'cpython-3.10.15';

export interface SandboxResult {
  exitedCleanly: boolean;
  output: string; // combined stdout+stderr, whichever Wandbox returns as the program's output
  isSyntaxError: boolean;
}

export async function runPython(code: string): Promise<SandboxResult> {
  const res = await fetch(WANDBOX_COMPILE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, compiler: PYTHON_COMPILER }),
  });

  if (!res.ok) {
    throw new Error(`Sandbox execution service returned ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    program_output?: string;
    program_error?: string;
  };

  const exitedCleanly = data.status === '0';
  const output = (data.program_error || data.program_output || '').trim();

  return {
    exitedCleanly,
    output,
    isSyntaxError: output.includes('SyntaxError'),
  };
}

/**
 * Builds a single script that defines the learner's code as a string constant,
 * appends the assignment's test suite, and calls its `test_<...>` functions.
 * The seeded test suites in this project are written to take the student's
 * source as a string and `exec()` it internally (see scripts/seed/assignment1_tests.py)
 * specifically so a single Wandbox execution can both run and grade the code —
 * that convention has to hold for any assignment's unit_test_suite_code.
 */
export function buildGradingScript(studentCode: string, testSuiteCode: string): string {
  const encoded = Buffer.from(studentCode, 'utf-8').toString('base64');
  return [
    'import base64',
    `student_code = base64.b64decode("${encoded}").decode("utf-8")`,
    '',
    testSuiteCode,
    '',
    '# Run every test_* function defined above against the student code.',
    'for _name, _fn in list(globals().items()):',
    '    if _name.startswith("test_") and callable(_fn):',
    '        _fn(student_code)',
    'print("ALL_TESTS_PASSED")',
  ].join('\n');
}
