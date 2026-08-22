import type { Room } from '@livekit/rtc-node';
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { publishJson } from './room-interactions.js';

// The "teaching screen" — the tutor's answer to "what if we make it, be
// like, displaying screen while it is teaching... like in google meet".
// Two shapes, picked by the tutor itself via tool calls: a live VS Code-like
// code demo for Python, or a designed slide for everything else
// (Entrepreneurship etc). Broadcast over the same reliable-data-channel
// pattern as publishPreparedVideo/HandRaiseListener; apps/web's
// TeachingScreen.tsx renders whichever shape is current.
export type TeachingScreen =
  | { type: 'code'; title: string; code: string; output: string | null; ranSuccessfully: boolean | null }
  | { type: 'slide'; title: string; points: string[] };

const WANDBOX_COMPILE_URL = 'https://wandbox.org/api/compile.json';
const PYTHON_COMPILER = 'cpython-3.10.15';

// Real execution, not a canned transcript — same public sandbox service
// apps/web/src/lib/sandbox.ts uses for grading, ported here so a live
// "showCode" demo can actually run and show real output, the way live
// coding in VS Code would.
async function runPython(code: string): Promise<{ exitedCleanly: boolean; output: string }> {
  const res = await fetch(WANDBOX_COMPILE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, compiler: PYTHON_COMPILER }),
  });
  if (!res.ok) throw new Error(`Sandbox execution service returned ${res.status}`);
  const data = (await res.json()) as { status: string; program_output?: string; program_error?: string };
  return {
    exitedCleanly: data.status === '0',
    output: (data.program_error || data.program_output || '(no output)').trim(),
  };
}

export function createTeachingScreenTools(room: Room) {
  const showCode = llm.tool({
    description:
      "Show a live code demo on the shared teaching screen, like coding in VS Code in front of the learner(s). Use this whenever you're walking through Python code — write the actual code you're explaining, not a description of it. Set run:true when you want to actually execute it and show real output (do this for any working example); set run:false only when the code is intentionally incomplete or wrong (e.g. showing a bug on purpose). Call again to replace the screen whenever you move to different code.",
    parameters: z.object({
      title: z.string().describe('Short label for what this code demonstrates, e.g. "Using a for loop"'),
      code: z.string().describe('The actual Python source code to display, real and runnable unless intentionally showing a bug'),
      run: z.boolean().describe('Whether to execute the code and show its real output on screen'),
    }),
    execute: async ({ title, code, run }) => {
      let output: string | null = null;
      let ranSuccessfully: boolean | null = null;
      if (run) {
        try {
          const result = await runPython(code);
          output = result.output;
          ranSuccessfully = result.exitedCleanly;
        } catch (err) {
          output = err instanceof Error ? err.message : 'Execution failed';
          ranSuccessfully = false;
        }
      }
      const screen: TeachingScreen = { type: 'code', title, code, output, ranSuccessfully };
      publishJson(room, 'teaching-screen', screen);
      return output
        ? `Code shown on screen. Real output: ${output}`
        : 'Code shown on screen (not executed).';
    },
  });

  const showSlide = llm.tool({
    description:
      "Show a short visual slide on the shared teaching screen when introducing or summarizing a concept that isn't code — like presenting a slide in a live meeting. Use for Entrepreneurship and any conceptual/non-code discussion. Keep it to a real title and 2-5 short, concrete points (not paragraphs). Call again to replace the slide whenever you move to a new concept.",
    parameters: z.object({
      title: z.string().describe('The concept or slide title, e.g. "The Lean Startup Loop"'),
      points: z.array(z.string()).describe('2-5 short, concrete bullet points — no long sentences'),
    }),
    execute: async ({ title, points }) => {
      const screen: TeachingScreen = { type: 'slide', title, points };
      publishJson(room, 'teaching-screen', screen);
      return 'Slide shown on screen.';
    },
  });

  return { showCode, showSlide };
}
