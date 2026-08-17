import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// JSON equivalent of /learn/[slug] for clients that can't render the web
// page — the mobile app, for now. Same admin-client rationale as the page:
// RLS is on with no policies yet.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: node } = await supabase
    .from('curriculum_nodes')
    .select('id, title, markdown_content')
    .eq('slug', slug)
    .maybeSingle();

  if (!node) {
    return NextResponse.json({ error: 'lesson not found' }, { status: 404 });
  }

  const { data: assignment } = await supabase
    .from('course_assignments')
    .select('id, title, instructions_markdown, starter_code')
    .eq('node_id', node.id)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ node, assignment: assignment ?? null });
}
