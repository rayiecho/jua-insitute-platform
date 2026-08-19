import { NextResponse } from 'next/server';

// Contextual, Socratic help scoped to the specific lesson/assignment a
// learner is stuck on — separate from the site-wide ChatWidget (which
// only knows enrollment/navigation, not lesson content) and from the live
// voice tutor (which requires booking a scheduled class). This is the
// "always available, explains concepts, never hands over the answer" layer
// requested directly after a real learner scored 30/100 and didn't know
// what to do next.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { messages, context } = (body ?? {}) as {
    messages?: { role: 'user' | 'assistant'; content: string }[];
    context?: {
      lessonTitle?: string;
      lessonContent?: string;
      assignmentInstructions?: string;
      studentSubmission?: string;
      feedback?: string;
    };
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Help assistant is not configured' }, { status: 500 });
  }

  const contextParts: string[] = [];
  if (context?.lessonTitle) contextParts.push(`Lesson: "${context.lessonTitle}"`);
  if (context?.lessonContent) contextParts.push(`Lesson material:\n${context.lessonContent}`);
  if (context?.assignmentInstructions) contextParts.push(`Assignment instructions:\n${context.assignmentInstructions}`);
  if (context?.studentSubmission) contextParts.push(`The learner's current submission:\n${context.studentSubmission}`);
  if (context?.feedback) contextParts.push(`Feedback they already received:\n${context.feedback}`);

  const systemPrompt = `You are a patient tutor helping a learner who is stuck on a specific lesson or assignment.

${contextParts.join('\n\n')}

Rules, non-negotiable:
- NEVER give the direct answer, the corrected code, or the exact text they should submit. Your job is to help them understand the underlying concept well enough to fix it themselves.
- Ask guiding questions and explain the "why" behind the concept, using their actual submission and feedback as the starting point when relevant.
- If they're clearly still lost after a couple of exchanges, say plainly that this might be worth a live session with their tutor, who can see their screen and walk through it together — don't just keep circling.
- Keep answers short and conversational — a few sentences, not a lecture.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-12)],
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Help assistant request failed: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return NextResponse.json({ error: 'Help assistant returned an empty reply' }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
