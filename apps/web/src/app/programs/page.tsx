import { createAdminClient } from '@/lib/supabase/admin';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { ProgramsBrowser } from '@/components/programs/ProgramsBrowser';

export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const supabase = createAdminClient();

  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, description, tagline, difficulty_level, status, slug')
    .order('created_at', { ascending: true });

  const { data: nodes } = await supabase.from('curriculum_nodes').select('course_id');
  const lessonCounts = new Map<string, number>();
  for (const node of nodes ?? []) {
    lessonCounts.set(node.course_id, (lessonCounts.get(node.course_id) ?? 0) + 1);
  }

  const programs = (courses ?? []).map((c) => ({ ...c, lessonCount: lessonCounts.get(c.id) ?? 0 }));

  return (
    <>
      <SiteHeader />
      <ProgramsBrowser programs={programs} />
    </>
  );
}
