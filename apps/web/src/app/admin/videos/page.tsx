import { createAdminClient } from '@/lib/supabase/admin';
import { VideoAdminTable } from '@/components/admin/VideoAdminTable';
import { PageHeader } from '@/components/admin/ui';

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
      <PageHeader
        title="Lesson Videos"
        description="Generate narrated lesson videos and post them to YouTube. Rendering runs through AfriVid Studio's API — this page polls for completion."
      />
      <div>
        <VideoAdminTable rows={rows} />
      </div>
    </div>
  );
}
