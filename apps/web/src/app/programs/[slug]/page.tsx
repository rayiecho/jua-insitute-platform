import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { EnrollAndStartButton } from '@/components/programs/EnrollAndStartButton';

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from('courses')
    .select('id, title, description, tagline, difficulty_level')
    .eq('slug', slug)
    .eq('status', 'live')
    .maybeSingle();

  if (!course) notFound();

  const { data: nodes } = await supabase
    .from('curriculum_nodes')
    .select('id, title, slug, sequence_order')
    .eq('course_id', course.id)
    .order('sequence_order', { ascending: true });

  const firstNode = nodes?.[0];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <span className="text-xs font-semibold tracking-wide text-tan uppercase">{course.difficulty_level}</span>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">{course.title}</h1>
        {course.tagline && <p className="mt-2 text-lg text-ink/70">{course.tagline}</p>}
        <p className="mt-4 text-ink/70">{course.description}</p>

        {firstNode && (
          <EnrollAndStartButton
            courseId={course.id}
            firstLessonHref={`/learn/${firstNode.slug}`}
            className="mt-8 inline-flex items-center rounded bg-gold px-6 py-3 text-sm font-semibold text-ink"
          />
        )}

        {nodes && nodes.length > 0 && (
          <div className="mt-12">
            <h2 className="font-serif text-xl font-semibold text-ink">Syllabus</h2>
            <ol className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
              {nodes.map((node, i) => (
                <li key={node.id}>
                  <Link
                    href={`/learn/${node.slug}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-background"
                  >
                    <span className="font-serif text-lg text-tan">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-medium text-ink">{node.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </>
  );
}
