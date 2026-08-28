import { createAdminClient } from '@/lib/supabase/admin';
import { VideoAdminTable, type CourseGroup } from '@/components/admin/VideoAdminTable';
import { PageHeader } from '@/components/admin/ui';

export default async function AdminVideosPage() {
  const supabase = createAdminClient();

  const [{ data: courses }, { data: weeks }, { data: nodes }] = await Promise.all([
    supabase.from('courses').select('id, title').order('created_at', { ascending: true }),
    supabase.from('course_weeks').select('id, course_id, week_number, title').order('week_number', { ascending: true }),
    supabase
      .from('curriculum_nodes')
      .select('id, title, slug, sequence_order, course_id, week_id, video_url, youtube_url')
      .eq('lesson_type', 'reading')
      .order('sequence_order', { ascending: true }),
  ]);

  const weeksById = new Map((weeks ?? []).map((w) => [w.id, w]));

  // Real hierarchy the rest of the app already uses (program -> week ->
  // lesson) instead of one flat list ordered only by a global sequence —
  // with 47+ lessons across two programs, "click Generate" needs the
  // program/week context to actually be usable, not just a giant table.
  const groups: CourseGroup[] = (courses ?? []).map((course) => {
    const courseNodes = (nodes ?? []).filter((n) => n.course_id === course.id);

    const weekMap = new Map<string, { weekNumber: number; title: string; rows: CourseGroup['weeks'][number]['rows'] }>();
    const noWeekRows: CourseGroup['weeks'][number]['rows'] = [];

    for (const n of courseNodes) {
      const row = {
        id: n.id,
        title: n.title,
        slug: n.slug,
        videoUrl: n.video_url,
        youtubeUrl: n.youtube_url,
      };
      const week = n.week_id ? weeksById.get(n.week_id) : null;
      if (!week) {
        noWeekRows.push(row);
        continue;
      }
      let entry = weekMap.get(week.id);
      if (!entry) {
        entry = { weekNumber: week.week_number, title: week.title, rows: [] };
        weekMap.set(week.id, entry);
      }
      entry.rows.push(row);
    }

    const weekGroups = Array.from(weekMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);
    if (noWeekRows.length > 0) {
      weekGroups.push({ weekNumber: Infinity, title: 'Unassigned', rows: noWeekRows });
    }

    return {
      courseId: course.id,
      courseTitle: course.title,
      weeks: weekGroups.map((w) => ({ label: w.weekNumber === Infinity ? w.title : `Week ${w.weekNumber}: ${w.title}`, rows: w.rows })),
    };
  }).filter((g) => g.weeks.length > 0);

  return (
    <div className="w-full max-w-5xl">
      <PageHeader
        title="Lesson Videos"
        description="Generate narrated lesson videos and post them to YouTube. Rendering runs through AfriVid Studio's API — this page polls for completion."
      />
      <VideoAdminTable groups={groups} />
    </div>
  );
}
