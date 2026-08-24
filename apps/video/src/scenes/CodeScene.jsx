import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../theme';

const KEYWORDS = new Set([
  'def', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as',
  'class', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'try', 'except',
  'finally', 'with', 'pass', 'break', 'continue', 'lambda', 'yield', 'global',
]);
const BUILTINS = new Set(['print', 'type', 'input', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple']);

// Minimal hand-rolled tokenizer — good enough for the short teaching
// snippets these lessons use, without pulling in a full syntax-highlighter
// dependency for a handful of colors.
function tokenizeLine(line) {
  const tokens = [];
  const commentIdx = line.indexOf('#');
  const codePart = commentIdx === -1 ? line : line.slice(0, commentIdx);
  const commentPart = commentIdx === -1 ? '' : line.slice(commentIdx);

  const re = /(""".*?"""|'.*?'|".*?"|\b\d+\.?\d*\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[^\sA-Za-z0-9_]+|\s+)/g;
  let match;
  while ((match = re.exec(codePart)) !== null) {
    const text = match[0];
    let color = '#e8ddc9';
    if (/^['"]/.test(text)) color = '#c8a165';
    else if (/^\d/.test(text)) color = '#8fb8a8';
    else if (KEYWORDS.has(text)) color = '#d99a6c';
    else if (BUILTINS.has(text)) color = '#c8862b';
    tokens.push({ text, color });
  }
  if (commentPart) tokens.push({ text: commentPart, color: '#6b6459' });
  return tokens;
}

// Redesigned 2026-08-24 alongside ConceptScene — the code window used to sit
// at 1100px on a 1920px canvas with a huge caption above it; now it uses
// nearly the full width and a much larger, more legible code/heading size.
export function CodeScene({ fraunces, scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const windowIn = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  const lines = (scene.code || '').split('\n');

  const glowOpacity = interpolate(frame, [0, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <div
        style={{
          position: 'absolute',
          bottom: -300,
          left: -300,
          width: 950,
          height: 950,
          borderRadius: '50%',
          opacity: glowOpacity * 0.12,
          background: `radial-gradient(circle, ${COLORS.gold} 0%, transparent 68%)`,
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      {scene.heading && (
        <div
          style={{
            opacity: headerOpacity,
            fontFamily: fraunces,
            fontWeight: 600,
            fontSize: 62,
            color: COLORS.ink,
            marginBottom: 50,
            textAlign: 'center',
            maxWidth: 1700,
          }}
        >
          {scene.heading}
        </div>
      )}
      <div
        style={{
          opacity: windowIn,
          transform: `translateY(${interpolate(windowIn, [0, 1], [30, 0])}px)`,
          width: 1740,
          borderRadius: 18,
          overflow: 'hidden',
          border: `2px solid ${COLORS.border}`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.14)',
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.card,
            padding: '16px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#e06050' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#e0c050' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#60c050' }} />
        </div>
        <div
          style={{
            backgroundColor: COLORS.ink,
            padding: '0 70px',
            minHeight: 660,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {lines.map((line, i) => {
            const lineIn = interpolate(frame, [22 + i * 5, 34 + i * 5], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={i}
                style={{
                  opacity: lineIn,
                  transform: `translateX(${interpolate(lineIn, [0, 1], [-16, 0])}px)`,
                  fontFamily: 'Courier New, monospace',
                  fontSize: 44,
                  lineHeight: 1.65,
                  whiteSpace: 'pre',
                }}
              >
                {tokenizeLine(line).map((tok, j) => (
                  <span key={j} style={{ color: tok.color }}>
                    {tok.text}
                  </span>
                ))}
                {line === '' && ' '}
              </div>
            );
          })}
        </div>
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
