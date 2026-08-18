import { NextResponse } from 'next/server';

// Text support widget — separate from the live voice tutor (which teaches
// curriculum). This one answers "how do I enroll", "why can't I join a
// class", "what programs exist" — site/process questions, not lesson
// content. Runs on Groq (already used by the agent, already configured on
// Vercel) rather than adding a new LLM vendor for a much lighter workload.
const SYSTEM_PROMPT = `You are the support assistant for Jua Institute, an online school where programs are taught through self-paced lessons plus live classes with an AI tutor.

Real facts about how the platform works — use these, don't invent others:
- Programs are project-based (e.g. Entrepreneurship: "From a real problem to your first paying customer"), structured in weeks with mixed lessons (readings, videos, case studies, quizzes) and a final live assessment week.
- To enroll: fill out the application on a program's page (name, education level, weekly time commitment, areas of interest, agree to policies), then verify your email with a one-time code sent to you — no link to click, just type the code shown after submitting.
- That verification happens once, ever. After that you can start lessons immediately and join live classes.
- Live classes: go to /tutor, type your first name and the email you enrolled with — no need to be signed in. You must be enrolled and verified first, or you'll be told to enroll.
- Progress (completed lessons, current program) shows on /dashboard once signed in.
- If you don't know a specific answer (pricing, exact dates, policy details you're unsure of), say so plainly and suggest they check the Terms of Use or Privacy Policy pages, or contact the program admin — never invent numbers or dates.

Keep answers short — a few sentences, not an essay. Be warm but direct.`;

export async function POST(request: Request) {
  const { messages } = (await request.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Assistant is not configured' }, { status: 500 });
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.slice(-12)],
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Assistant request failed: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    return NextResponse.json({ error: 'Assistant returned an empty reply' }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
