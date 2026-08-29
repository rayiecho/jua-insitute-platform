'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'Do I need any experience to start?',
    a: 'No — every program starts from true zero and is built for complete beginners.',
  },
  {
    q: 'Is the tutor a real person?',
    a: "It's AI — but live and voice-based, one-on-one or in a small cohort, not a chatbot you type at. It already knows what you've done before each session starts.",
  },
  {
    q: 'Can I skip ahead if I already know something?',
    a: "No — every step has to be genuinely verified before the next one unlocks. That's deliberate: it's the opposite of how AI gets used to shortcut coursework today.",
  },
  {
    q: 'What do I get instead of a certificate?',
    a: 'A verifiable portfolio — actual projects and graded work, not just a line that says you passed.',
  },
  {
    q: 'How much time does it take each week?',
    a: 'Two live sessions a week (45–90 minutes depending on the program), plus self-paced work in between, on your own schedule.',
  },
  {
    q: 'Do I need any special software?',
    a: 'No — everything runs in your browser, including the live voice sessions and the code sandbox.',
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto w-full max-w-2xl divide-y divide-border rounded-lg border border-border bg-card">
      {FAQS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={open}
            >
              <span className="font-medium text-ink">{item.q}</span>
              <span className={`shrink-0 text-ink/40 transition-transform ${open ? 'rotate-45' : ''}`} aria-hidden>
                +
              </span>
            </button>
            {open && <p className="px-5 pb-4 text-sm leading-relaxed text-ink/70">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
