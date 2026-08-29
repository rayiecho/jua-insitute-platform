import { createAdminClient } from '@/lib/supabase/admin';
import { VideoAdminTable, type CourseGroup } from '@/components/admin/VideoAdminTable';
import { PageHeader } from '@/components/admin/ui';

export default async function AdminVideosPage() {
  const supabase = createAdminClient();

  const [{ data: courses }, { data: weeks }, { data: nodes }, { data: activeJobs }] = await Promise.all([
    supabase.from('courses').select('id, title').order('created_at', { ascending: true }),
    supabase.from('course_weeks').select('id, course_id, week_number, title').order('week_number', { ascending: true }),
    supabase
      .from('curriculum_nodes')
      .select('id, title, slug, sequence_order, course_id, week_id, video_url, youtube_url')
      .eq('lesson_type', 'reading')
      .order('sequence_order', { ascending: true }),
    // Jobs still queued/running server-side (real work that keeps going
    // whether or not this page — or the tab that started it — is open).
    // Hydrating these into the initial render means a reload correctly
    // shows "Generating…" and resumes polling instead of resetting to
    // idle and risking a duplicate click on a job already in flight.
    // Cut off at 1 hour: confirmed live that a Railway redeploy mid-job
    // orphans its row at 'queued'/'running' forever (the process that
    // would ever update it is gone) — a real single video takes at most
    // a few minutes per AfriVid's own docs, so anything older than this
    // is dead, not actually in progress.
    supabase
      .from('video_jobs')
      .select('id, node_id, kind, status')
      .in('status', ['queued', 'running'])
      .gte('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const weeksById = new Map((weeks ?? []).map((w) => [w.id, w]));

  // One active job per (node, kind) — created_at DESC means the first one
  // seen per key is the most recent.
  const activeByNodeKind = new Map<string, string>();
  for (const job of activeJobs ?? []) {
    const key = `${job.node_id}:${job.kind}`;
    if (!activeByNodeKind.has(key)) activeByNodeKind.set(key, job.id);
  }

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
        activeGenerateJobId: activeByNodeKind.get(`${n.id}:generate`) ?? null,
        activeYoutubeJobId: activeByNodeKind.get(`${n.id}:youtube_upload`) ?? null,
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
    <div className="w-full max-w-6xl">
      <PageHeader
        title="Lesson Videos"
        description="Generate narrated lesson videos and post them to YouTube. Rendering runs through AfriVid Studio's API and continues server-side even if you close this tab — this page just polls for completion."
      />
      <VideoAdminTable groups={groups} />
    </div>
  );
}
