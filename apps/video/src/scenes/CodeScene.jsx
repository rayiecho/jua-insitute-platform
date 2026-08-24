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

export function CodeScene({ fraunces, scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const windowIn = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  const lines = (scene.code || '').split('\n');

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      {scene.heading && (
        <div
          style={{
            opacity: headerOpacity,
            fontFamily: fraunces,
            fontWeight: 600,
            fontSize: 44,
            color: COLORS.ink,
            marginBottom: 40,
            textAlign: 'center',
            maxWidth: 1200,
          }}
        >
          {scene.heading}
        </div>
      )}
      <div
        style={{
          opacity: windowIn,
          transform: `translateY(${interpolate(windowIn, [0, 1], [30, 0])}px)`,
          width: 1100,
          borderRadius: 16,
          overflow: 'hidden',
          border: `2px solid ${COLORS.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.card,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#e06050' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#e0c050' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#60c050' }} />
        </div>
        <div style={{ backgroundColor: COLORS.ink, padding: '32px 36px' }}>
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
                  fontSize: 26,
                  lineHeight: 1.6,
                  whiteSpace: 'pre',
                }}
              >
                {tokenizeLine(line).map((tok, j) => (
                  <span key={j} style={{ color: tok.color }}>
                    {tok.text}
                  </span>
                ))}
                {line === '' && ' '}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
