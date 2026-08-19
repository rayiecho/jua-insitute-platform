'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface LessonHelpContext {
  lessonTitle?: string;
  lessonContent?: string;
  assignmentInstructions?: string;
  studentSubmission?: string;
  feedback?: string;
}

// Always-available, per-lesson help — separate from the site-wide
// ChatWidget (navigation-only) and the live voice tutor (has to be
// booked). Explains concepts and asks guiding questions rather than
// handing over the answer (enforced in the system prompt server-side,
// see api/lesson-help/route.ts) — if that's not enough after a couple of
// exchanges, the assistant itself says so and this points at /tutor.
export function LessonHelpChat({ context, autoOpen = false }: { context: LessonHelpContext; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/lesson-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to reach the help assistant');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm font-semibold text-ink hover:bg-gold/20"
      >
        💬 Ask AI to explain this
      </button>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2.5">
        <p className="text-sm font-semibold text-ink">Ask about this lesson</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink/50 hover:text-ink">
          Close
        </button>
      </div>

      <div ref={scrollRef} className="max-h-80 min-h-[140px] overflow-y-auto bg-card px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink/50">
            Ask what you're stuck on — I'll help you understand the concept, not just hand you the answer.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user' ? 'ml-auto bg-gold text-ink' : 'bg-background text-ink'
              }`}
            >
              {m.content}
            </div>
          ))}
          {sending && <div className="max-w-[90%] rounded-xl bg-background px-3 py-2 text-sm text-ink/50">Thinking…</div>}
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border bg-card p-3">
        <input
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-ink"
          placeholder="What's confusing you?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded bg-gold px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <div className="border-t border-border bg-background px-4 py-2.5 text-center">
        <Link href="/tutor" className="text-xs font-medium text-tan hover:text-ink">
          Still stuck? Book a live class with your tutor →
        </Link>
      </div>
    </div>
  );
}
