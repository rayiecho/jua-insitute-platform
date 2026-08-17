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

  // course_weeks may not exist yet (migration 0006 pending) — degrade to
  // "no week structure" rather than breaking the page.
  const weeksByCourse = new Map<string, { weekNumber: number; title: string; isFinal: boolean }[]>();
  const { data: weeks } = await supabase
    .from('course_weeks')
    .select('course_id, week_number, title, is_final_assessment')
    .order('week_number', { ascending: true });
  for (const w of weeks ?? []) {
    const list = weeksByCourse.get(w.course_id) ?? [];
    list.push({ weekNumber: w.week_number, title: w.title, isFinal: w.is_final_assessment });
    weeksByCourse.set(w.course_id, list);
  }

  const programs = (courses ?? []).map((c) => ({
    ...c,
    lessonCount: lessonCounts.get(c.id) ?? 0,
    weeks: weeksByCourse.get(c.id) ?? [],
  }));

  return (
    <>
      <SiteHeader />
      <ProgramsBrowser programs={programs} />
    </>
  );
}
