import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { createAdminClient } from '@/lib/supabase/admin';
import { AssignmentPanel } from '@/components/tutor/AssignmentPanel';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { YouTubeEmbed } from '@/components/programs/YouTubeEmbed';
import { LessonViewTracker } from '@/components/programs/LessonViewTracker';
import { QuizLesson } from '@/components/programs/QuizLesson';

const LESSON_TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  reading: 'Reading',
  case_study: 'Case study',
  quiz: 'Quiz',
  puzzle: 'Exercise',
};

// Curriculum content is public read data with no learner-specific access rule,
// but this project's Supabase instance has RLS on with no policies defined yet
// (see packages/supabase/README.md) — the anon key can't read anything until
// policies exist. Using the admin client here is the same pattern already used
// by /api/learner and /api/livekit-token: trusted server-side code bypasses RLS
// rather than the browser talking to Supabase directly with an anon key that
// currently can't do anything.
export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: node } = await supabase
    .from('curriculum_nodes')
    .select('id, course_id, title, markdown_content, video_url, lesson_type')
    .eq('slug', slug)
    .maybeSingle();

  if (!node) notFound();

  if (node.lesson_type === 'quiz') {
    const { data: questions } = await supabase
      .from('quiz_questions')
      .select('id, question, options, correct_index, explanation')
      .eq('node_id', node.id)
      .order('sequence_order', { ascending: true });

    return (
      <>
        <SiteHeader />
        <LessonViewTracker courseId={node.course_id} nodeId={node.id} />
        <main className="mx-auto w-full max-w-6xl px-6 py-10">
          <QuizLesson title={node.title} questions={questions ?? []} />
        </main>
      </>
    );
  }

  const { data: assignment } = await supabase
    .from('course_assignments')
    .select('id, title, instructions_markdown, starter_code')
    .eq('node_id', node.id)
    .limit(1)
    .maybeSingle();

  const typeLabel = LESSON_TYPE_LABEL[node.lesson_type] ?? null;

  const article = (
    <article className="max-w-none space-y-4 leading-relaxed text-ink [&_code]:rounded [&_code]:bg-card [&_code]:px-1 [&_code]:py-0.5 [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:font-serif [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-ink [&_pre]:p-4 [&_pre]:text-background">
      {typeLabel && (
        <span className="inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-dark">
          {typeLabel}
        </span>
      )}
      {node.video_url && <YouTubeEmbed url={node.video_url} />}
      <ReactMarkdown>{node.markdown_content}</ReactMarkdown>
      {assignment && (
        <>
          <hr className="border-border" />
          <h2 className="font-serif text-xl font-semibold">{assignment.title}</h2>
          <ReactMarkdown>{assignment.instructions_markdown}</ReactMarkdown>
        </>
      )}
    </article>
  );

  return (
    <>
      <SiteHeader />
      <LessonViewTracker courseId={node.course_id} nodeId={node.id} />
      {assignment ? (
        <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-2">
          {article}
          <div className="lg:sticky lg:top-10 lg:h-[calc(100vh-5rem)]">
            <AssignmentPanel assignmentId={assignment.id} starterCode={assignment.starter_code ?? ''} />
          </div>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-3xl px-6 py-10">{article}</main>
      )}
    </>
  );
}
