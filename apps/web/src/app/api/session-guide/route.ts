import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Backs the live-class "session guide" panel — same underlying data the
// agent's continuity context (apps/agent/src/continuity.ts) uses, exposed to
// the client so the learner can see the lesson material and prepared video
// themselves rather than only hearing it read aloud.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const learnerId = searchParams.get('learnerId');
  if (!learnerId) {
    return NextResponse.json({ error: 'learnerId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data } = await supabase
    .from('session_curriculum_context')
    .select(
      'node:curriculum_nodes!active_node_id(title, markdown_content, video_url, course:courses(title)), assignment:course_assignments!active_assignment_id(title, instructions_markdown)',
    )
    .eq('user_id', learnerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ guide: null });
  }

  const node = Array.isArray(data.node) ? data.node[0] : data.node;
  const course = Array.isArray(node?.course) ? node.course[0] : node?.course;
  const assignment = Array.isArray(data.assignment) ? data.assignment[0] : data.assignment;

  return NextResponse.json({
    guide: {
      courseTitle: course?.title ?? null,
      nodeTitle: node?.title ?? null,
      nodeContent: node?.markdown_content ?? null,
      videoUrl: node?.video_url ?? null,
      assignmentTitle: assignment?.title ?? null,
      assignmentInstructions: assignment?.instructions_markdown ?? null,
    },
  });
}
