// Structured "canvas" assignments (Business Model Canvas, unit-economics
// calculators, and similar) — the non-code equivalent of the Monaco editor's
// hands-on feel. Deliberately schema-free: rather than a course_assignments
// migration (which would need the user to run manual SQL before any of this
// works), the field definitions live inside instructions_markdown itself, in
// a fenced ```canvas block, authored the same way any other lesson content
// is. This function extracts that block and returns the fields plus the
// remaining markdown to actually show the learner (with the block stripped
// out, so the raw JSON never renders as visible instructions).
export interface CanvasFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  placeholder?: string;
  /** Only for type: 'number'. A simple arithmetic expression over other
   * numeric field keys, e.g. "price - cost". Evaluated live as the learner
   * types, shown read-only. Author-controlled (from seeded lesson content),
   * never learner input, so a plain Function-based evaluator is safe here. */
  formula?: string;
}

const CANVAS_BLOCK_RE = /```canvas\n([\s\S]*?)\n```/;

export function parseCanvasFields(markdown: string): { fields: CanvasFieldDef[]; cleanedInstructions: string } | null {
  const match = markdown.match(CANVAS_BLOCK_RE);
  if (!match) return null;
  try {
    const fields = JSON.parse(match[1]) as CanvasFieldDef[];
    if (!Array.isArray(fields) || fields.length === 0) return null;
    const cleanedInstructions = markdown.replace(CANVAS_BLOCK_RE, '').trim();
    return { fields, cleanedInstructions };
  } catch {
    return null;
  }
}

// Evaluates a formula field's expression using only the OTHER numeric
// field values currently entered. Non-numeric/missing inputs treated as 0
// so a partially-filled canvas still shows a live (if incomplete) result
// rather than an error.
export function evaluateFormula(formula: string, values: Record<string, string>): number | null {
  const numericEntries = Object.entries(values).map(([k, v]) => [k, Number(v) || 0] as const);
  const names = numericEntries.map(([k]) => k);
  const args = numericEntries.map(([, v]) => v);
  try {
    // eslint-disable-next-line no-new-func -- formulas are author-controlled
    // lesson content (seeded by us), never raw learner input.
    const fn = new Function(...names, `return (${formula});`);
    const result = fn(...args);
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

// Formats submitted values into readable text for the existing written-review
// grading path (/api/grade's requestWrittenReview) — no backend changes
// needed, this just becomes the textResponse.
export function formatCanvasSubmission(fields: CanvasFieldDef[], values: Record<string, string>): string {
  return fields
    .map((f) => `${f.label}: ${values[f.key]?.trim() || '(left blank)'}`)
    .join('\n\n');
}
