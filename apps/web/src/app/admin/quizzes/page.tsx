import { createAdminClient } from '@/lib/supabase/admin';
import { DeleteQuizQuestionButton } from '@/components/admin/DeleteQuizQuestionButton';

export default async function AdminQuizzesPage() {
  const supabase = createAdminClient();

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select(
      'id, question, options, correct_index, sequence_order, node:curriculum_nodes(title, course:courses(title))',
    )
    .order('sequence_order', { ascending: true });

  type Question = NonNullable<typeof questions>[number];
  interface LessonGroup {
    lessonTitle: string;
    courseTitle: string;
    questions: Question[];
  }
  const byLesson = new Map<string, LessonGroup>();
  for (const q of questions ?? []) {
    const node = Array.isArray(q.node) ? q.node[0] : q.node;
    const course = Array.isArray(node?.course) ? node.course[0] : node?.course;
    const key = node?.title ?? 'Unknown lesson';
    let entry = byLesson.get(key);
    if (!entry) {
      entry = { lessonTitle: key, courseTitle: course?.title ?? '', questions: [] };
      byLesson.set(key, entry);
    }
    entry.questions.push(q);
  }

  return (
    <div className="w-full max-w-4xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Quizzes</h1>
      <p className="mt-1 text-sm text-ink/60">
        {questions?.length ?? 0} questions across {byLesson.size} quiz lessons.
      </p>

      <div className="mt-6 space-y-8">
        {Array.from(byLesson.values()).map((lesson) => (
          <div key={lesson.lessonTitle}>
            <p className="text-xs font-semibold uppercase tracking-wide text-tan">{lesson.courseTitle}</p>
            <h2 className="font-serif text-lg font-semibold text-ink">{lesson.lessonTitle}</h2>
            <div className="mt-3 space-y-3">
              {lesson.questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-ink">{q.question}</p>
                    <DeleteQuizQuestionButton id={q.id} />
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(q.options as string[]).map((opt, i) => (
                      <li key={i} className={i === q.correct_index ? 'font-medium text-gold-dark' : 'text-ink/60'}>
                        {i === q.correct_index ? '✓ ' : '· '}
                        {opt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
        {(!questions || questions.length === 0) && <p className="text-ink/60">No quiz questions yet.</p>}
      </div>
    </div>
  );
}
