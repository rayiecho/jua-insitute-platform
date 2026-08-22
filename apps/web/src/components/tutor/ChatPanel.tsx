'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat, useLocalParticipant } from '@livekit/components-react';

// "Just like Google Meet, people can type in the chat, and the tutor must
// be able to get what is typed" — uses LiveKit's built-in text-stream chat
// protocol (useChat(), topic "lk.chat") rather than a custom data channel,
// since apps/agent/src/chat-listener.ts reads that same standard protocol
// directly via rtc-node's registerTextStreamHandler. The tutor treats a
// typed message as a real question and responds out loud, not just a
// passive log entry.
export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await send(text);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="font-serif text-lg font-semibold text-ink">Chat</p>
        <button type="button" onClick={onClose} className="text-sm text-ink/50 hover:text-ink">
          Close
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4">
        {chatMessages.length === 0 && (
          <p className="text-sm text-ink/40">
            Type a message and your tutor will read it and respond — useful if you'd rather not speak, or your mic
            is off.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {chatMessages.map((msg) => {
            const isMe = msg.from?.identity === localParticipant.identity;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-ink/40">
                  {isMe ? 'You' : msg.from?.name || 'Tutor'}
                </span>
                <span
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                    isMe ? 'rounded-br-sm bg-gold text-ink' : 'rounded-bl-sm bg-background text-ink'
                  }`}
                >
                  {msg.message}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm text-ink"
          placeholder="Message your tutor…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
