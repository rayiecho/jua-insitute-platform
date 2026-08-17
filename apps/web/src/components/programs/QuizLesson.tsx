'use client';

import { useState } from 'react';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

export function QuizLesson({ title, questions }: { title: string; questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const answeredCount = Object.keys(revealed).length;
  const correctCount = questions.filter((q) => revealed[q.id] && answers[q.id] === q.correct_index).length;
  const done = answeredCount === questions.length;

  function choose(questionId: string, optionIndex: number) {
    if (revealed[questionId]) return; // already answered — don't let them change it after seeing feedback
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    setRevealed((prev) => ({ ...prev, [questionId]: true }));
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>

      {done && (
        <p className="mt-4 rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm font-medium text-ink">
          {correctCount} / {questions.length} correct
        </p>
      )}

      <div className="mt-6 space-y-6">
        {questions.map((q, i) => {
          const chosen = answers[q.id];
          const isRevealed = revealed[q.id];
          return (
            <div key={q.id} className="rounded-lg border border-border bg-card p-5">
              <p className="font-medium text-ink">
                {i + 1}. {q.question}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {q.options.map((option, optionIndex) => {
                  const isChosen = chosen === optionIndex;
                  const isCorrect = optionIndex === q.correct_index;
                  let style = 'border-border hover:bg-background';
                  if (isRevealed && isCorrect) style = 'border-gold bg-gold/10';
                  else if (isRevealed && isChosen && !isCorrect) style = 'border-red-300 bg-red-50';
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      onClick={() => choose(q.id, optionIndex)}
                      disabled={isRevealed}
                      className={`rounded border px-4 py-2 text-left text-sm text-ink transition-colors ${style}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {isRevealed && q.explanation && <p className="mt-3 text-sm text-ink/60">{q.explanation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
