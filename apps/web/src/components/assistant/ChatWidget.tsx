'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { LogoMark } from '@/components/brand/Logo';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Site-wide support chat — separate from the live voice tutor (which
// teaches curriculum in a scheduled class). This is for "how do I enroll" /
// "why can't I join a class" type questions, answerable instantly without
// booking a session. Mounted globally in the root layout so it's available
// from any page.
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

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
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to reach the assistant');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <LogoMark className="h-6 w-6" />
            <div>
              <p className="text-sm font-semibold text-ink">Jua Institute Assistant</p>
              <p className="text-xs text-ink/50">Ask about enrolling, classes, or your account</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="mt-4 text-center text-sm text-ink/50">
                Hi! Ask me anything about enrolling, verifying your email, or joining a live class.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed [&_p]:m-0 [&_strong]:font-semibold ${
                    m.role === 'user' ? 'ml-auto bg-gold text-ink' : 'bg-background text-ink'
                  }`}
                >
                  {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                </div>
              ))}
              {sending && <div className="max-w-[85%] rounded-xl bg-background px-3 py-2 text-sm text-ink/50">Thinking…</div>}
            </div>
            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <input
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-ink"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded bg-gold px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-border transition-transform hover:scale-105"
      >
        <LogoMark className="h-9 w-9" />
      </button>
    </>
  );
}
