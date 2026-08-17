-- Jua Institute — switch long-term memory to a local embedding model.
-- OpenAI credits are exhausted and no Anthropic key is configured yet, so
-- there's no hosted embeddings provider available right now. The agent
-- worker generates embeddings in-process instead (Xenova/all-MiniLM-L6-v2,
-- 384 dims, no API key/billing needed — see apps/agent/src/embeddings.ts).
-- Table has zero rows so far (nothing has ever written to it), so this is a
-- safe column-type change, not a backfill.

alter table lesson_memory_vectors alter column embedding type vector(384);

-- Semantic search RPC — supabase-js can't express `order by embedding <=> $1`
-- through the query builder, so this is the standard Supabase+pgvector
-- pattern: a SQL function called via .rpc().
create or replace function match_lesson_memories(
  query_embedding vector(384),
  match_user_id uuid,
  match_count int default 5
)
returns table (summary_text text, similarity float)
language sql stable
as $$
  select summary_text, 1 - (embedding <=> query_embedding) as similarity
  from lesson_memory_vectors
  where user_id = match_user_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ivfflat index still deliberately not built yet (see 0001_init.sql) — it
-- needs representative data to choose good cluster centers, and the table
-- is still empty. Build it once real sessions have generated memories:
-- create index idx_memory_vectors_embedding on lesson_memory_vectors
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);
