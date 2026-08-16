# Supabase schema

Source of truth for the schema is `platform-technical-specification-mvp.md` Section 3.
`migrations/0001_init.sql` is a direct, unmodified translation of that section — do not
hand-edit table shapes here without updating the spec doc too.

## Applying locally

```bash
supabase init            # first time only, from repo root
supabase start
supabase db reset        # applies everything in migrations/
```

## Applying to a hosted project

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Notes

- `lesson_memory_vectors.embedding` is `vector(1536)` — sized for OpenAI's
  `text-embedding-3-small`/`ada-002`. Change the dimension here if the embedding
  model changes.
- The `ivfflat` index on `embedding` is commented out in the migration — build it
  after there's real data to cluster on, per pgvector's own guidance.
- No RLS policies are defined yet. This is fine while all writes go through the
  agent worker / server routes with the service role key, but must be locked down
  before any client talks to Supabase directly with a user JWT.
