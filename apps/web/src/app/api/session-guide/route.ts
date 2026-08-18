import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Backs the live-class "session guide" panel — mirrors
// apps/agent/src/continuity.ts's resolution logic (computed fresh from the
// learner's actual enrollment every call, not from session_curriculum_context's
// "most recent row"). That history table only ever gets a new row when a
// learner is enrolled, so the "most recent row ever" could silently be a
// stale row from an entirely different course — this panel had the same bug
// class already fixed for the tutor's spoken context, just never carried
// over here. Now also surfaces the whole WEEK's outline (not just one
// lesson), matching what the live session actually teaches.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const learnerId = searchParams.get('learnerId');
  if (!learnerId) {
    return NextResponse.json({ error: 'learnerId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course_id, last_viewed_node_id, course:courses(title)')
    .eq('user_id', learnerId)
    .order('last_viewed_at', { ascending: false, nullsFirst: false })
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ guide: null });
  }

  const course = Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course;
  const courseTitle = course?.title ?? null;

  type Node = { title: string; markdown_content: string; video_url: string | null; week_id: string | null };
  let node: Node | null = null;
  let assignmentTitle: string | null = null;
  let assignmentInstructions: string | null = null;

  const { data: inProgressRows } = await supabase
    .from('student_assignments_progress')
    .select(
      'assignment:course_assignments(title, instructions_markdown, node:curriculum_nodes(title, markdown_content, video_url, week_id, course_id))',
    )
    .eq('user_id', learnerId)
    .eq('grading_status', 'in_progress')
    .order('updated_at', { ascending: false });

  for (const row of inProgressRows ?? []) {
    const assignment = Array.isArray(row.assignment) ? row.assignment[0] : row.assignment;
    const candidateNode = Array.isArray(assignment?.node) ? assignment.node[0] : assignment?.node;
    if (candidateNode?.course_id === enrollment.course_id) {
      node = candidateNode;
      assignmentTitle = assignment?.title ?? null;
      assignmentInstructions = assignment?.instructions_markdown ?? null;
      break;
    }
  }

  if (!node && enrollment.last_viewed_node_id) {
    const { data: lastViewed } = await supabase
      .from('curriculum_nodes')
      .select('title, markdown_content, video_url, week_id')
      .eq('id', enrollment.last_viewed_node_id)
      .maybeSingle();
    node = lastViewed ?? null;
  }

  if (!node) {
    const { data: firstNode } = await supabase
      .from('curriculum_nodes')
      .select('title, markdown_content, video_url, week_id')
      .eq('course_id', enrollment.course_id)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    node = firstNode ?? null;
  }

  if (!node) {
    return NextResponse.json({ guide: { courseTitle, week: null, nodeTitle: null, nodeContent: null, videoUrl: null, assignmentTitle: null, assignmentInstructions: null } });
  }

  let week: { weekNumber: number; title: string; summary: string; lessonTitles: string[] } | null = null;

  if (node.week_id) {
    const { data: weekRow } = await supabase
      .from('course_weeks')
      .select('week_number, title, summary')
      .eq('id', node.week_id)
      .maybeSingle();
    const { data: weekNodes } = await supabase
      .from('curriculum_nodes')
      .select('title')
      .eq('week_id', node.week_id)
      .order('sequence_order', { ascending: true });

    if (weekRow) {
      week = {
        weekNumber: weekRow.week_number,
        title: weekRow.title,
        summary: weekRow.summary,
        lessonTitles: (weekNodes ?? []).map((n) => n.title),
      };
    }
  }

  return NextResponse.json({
    guide: {
      courseTitle,
      week,
      nodeTitle: node.title,
      nodeContent: node.markdown_content,
      videoUrl: node.video_url,
      assignmentTitle,
      assignmentInstructions,
    },
  });
}
