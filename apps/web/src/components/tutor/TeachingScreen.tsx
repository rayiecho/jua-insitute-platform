'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useDataChannel } from '@livekit/components-react';

type TeachingScreenState =
  | { type: 'code'; title: string; code: string; output: string | null; ranSuccessfully: boolean | null }
  | { type: 'slide'; title: string; points: string[] };

// The "displaying screen while it is teaching... like in google meet" ask —
// the tutor (apps/agent/src/teaching-screen.ts) decides what to show and
// broadcasts it over a reliable data channel, exactly like
// SessionGuidePanel's shared-video and HandRaiseListener's hand-raise.
// Renders as the primary stage content in TutorSessionUI whenever active,
// the same way a real screen-share would.
export function useTeachingScreen(): TeachingScreenState | null {
  const [screen, setScreen] = useState<TeachingScreenState | null>(null);

  useDataChannel('teaching-screen', (msg) => {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(msg.payload)) as TeachingScreenState;
      setScreen(parsed);
    } catch {
      // malformed payload — ignore, keep whatever was showing
    }
  });

  return screen;
}

export function TeachingScreen({ screen }: { screen: TeachingScreenState }) {
  return screen.type === 'code' ? <CodeScreen screen={screen} /> : <SlideScreen screen={screen} />;
}

function CodeScreen({ screen }: { screen: Extract<TeachingScreenState, { type: 'code' }> }) {
  const lineCount = screen.code.split('\n').length;
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/60">
        <span className="flex items-center gap-2 font-mono">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-1">{screen.title}</span>
        </span>
        <span className="flex items-center gap-1.5 font-medium text-gold">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
          Live demo
        </span>
      </div>
      <div className={screen.output ? 'flex-[3] min-h-0' : 'flex-1 min-h-0'}>
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={screen.code}
          options={{
            readOnly: true,
            minimap: { enabled: lineCount > 25 },
            fontSize: 13,
            lineHeight: 20,
            padding: { top: 14 },
            scrollBeyondLastLine: false,
            fontFamily: 'var(--font-mono), Menlo, Consolas, monospace',
          }}
        />
      </div>
      {screen.output && (
        <div className="flex-[1] min-h-0 overflow-y-auto border-t border-white/10 bg-black/40 px-4 py-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-white/40">
            {screen.ranSuccessfully === false ? 'Output (error)' : 'Output'}
          </p>
          <pre
            className={`whitespace-pre-wrap break-words font-mono text-xs ${
              screen.ranSuccessfully === false ? 'text-red-400' : 'text-[#8ee08e]'
            }`}
          >
            {screen.output}
          </pre>
        </div>
      )}
    </div>
  );
}

const SLIDE_ACCENTS = ['#c98a2c', '#8a6d3b', '#b5762a', '#a9762f', '#c39a4d', '#9c6b2e'];

function SlideScreen({ screen }: { screen: Extract<TeachingScreenState, { type: 'slide' }> }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center overflow-hidden bg-ink px-10 py-10 sm:px-16">
      {/* Decorative depth so it reads as a designed slide, not a plain text
          box — two soft blurred fields, dark background, no clipart. */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto w-full max-w-2xl">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Jua Institute
        </span>
        <h2
          key={screen.title}
          className="mt-4 font-serif text-3xl font-semibold leading-[1.15] text-white sm:text-4xl"
          style={{ animation: 'slide-in-up 0.5s ease-out' }}
        >
          {screen.title}
        </h2>
        <div className="mt-7 h-px w-20 bg-gradient-to-r from-gold to-transparent" />
        <ul className="mt-8 flex flex-col gap-5">
          {screen.points.map((point, i) => (
            <li
              key={`${screen.title}-${i}`}
              className="flex items-start gap-4"
              style={{ animation: `slide-in-up 0.45s ease-out ${0.08 * (i + 1)}s both` }}
            >
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-ink shadow-sm"
                style={{ backgroundColor: SLIDE_ACCENTS[i % SLIDE_ACCENTS.length] }}
              >
                {i + 1}
              </span>
              <span className="pt-1 text-lg leading-snug text-white/90 sm:text-xl">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        @keyframes slide-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
