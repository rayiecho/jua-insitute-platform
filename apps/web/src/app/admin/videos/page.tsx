import { createAdminClient } from '@/lib/supabase/admin';
import { VideoAdminTable } from '@/components/admin/VideoAdminTable';

export default async function AdminVideosPage() {
  const supabase = createAdminClient();

  const { data: nodes } = await supabase
    .from('curriculum_nodes')
    .select('id, title, slug, sequence_order, lesson_type, video_url, youtube_url, course:courses(title)')
    .eq('lesson_type', 'reading')
    .order('sequence_order', { ascending: true });

  const rows = (nodes ?? []).map((n) => {
    const course = Array.isArray(n.course) ? n.course[0] : n.course;
    return {
      id: n.id,
      title: n.title,
      slug: n.slug,
      course: course?.title,
      videoUrl: n.video_url,
      youtubeUrl: n.youtube_url,
    };
  });

  return (
    <div className="w-full max-w-5xl">
      <h1 className="font-serif text-2xl font-semibold text-ink">Lesson Videos</h1>
      <p className="mt-1 text-sm text-ink/60">
        Generate narrated lesson videos and post them to YouTube. Rendering runs on a separate service and can take a
        few minutes — this page polls for completion.
      </p>
      <div className="mt-6">
        <VideoAdminTable rows={rows} />
      </div>
    </div>
  );
}
