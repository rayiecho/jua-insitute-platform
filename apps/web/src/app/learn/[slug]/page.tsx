import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { createAdminClient } from '@/lib/supabase/admin';
import { AssignmentPanel } from '@/components/tutor/AssignmentPanel';

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
    .select('id, title, markdown_content')
    .eq('slug', slug)
    .maybeSingle();

  if (!node) notFound();

  const { data: assignment } = await supabase
    .from('course_assignments')
    .select('id, title, instructions_markdown, starter_code')
    .eq('node_id', node.id)
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-2">
      <article className="max-w-none space-y-4 leading-relaxed [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-gray-900 [&_pre]:p-4 [&_pre]:text-gray-50">
        <ReactMarkdown>{node.markdown_content}</ReactMarkdown>
        {assignment && (
          <>
            <hr />
            <h2 className="text-xl font-semibold">{assignment.title}</h2>
            <ReactMarkdown>{assignment.instructions_markdown}</ReactMarkdown>
          </>
        )}
      </article>

      <div className="lg:sticky lg:top-10 lg:h-[calc(100vh-5rem)]">
        {assignment ? (
          <AssignmentPanel assignmentId={assignment.id} starterCode={assignment.starter_code ?? ''} />
        ) : (
          <p className="text-sm text-gray-500">No assignment attached to this lesson yet.</p>
        )}
      </div>
    </main>
  );
}
