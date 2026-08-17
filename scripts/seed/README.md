# Seed content

Source content for the one demo lesson seeded into Supabase during Phase 2
development — course "Intro to Python", node "Variables and Types"
(`slug: variables-and-types`), assignment "Build a Summary String".

These files aren't loaded automatically by any script yet; they were pasted
into `curriculum_nodes.markdown_content` / `course_assignments.*` via the
Supabase REST API directly. If this needs to be reproducible (e.g. for a
fresh Supabase project), turn this into a real seed script that reads these
files and upserts the rows — right now it's just the source-of-truth content,
kept here instead of only living in the database.
