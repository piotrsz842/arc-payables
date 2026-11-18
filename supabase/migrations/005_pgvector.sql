-- 005: meaning-based search with pgvector. Run once in the Supabase SQL Editor. Safe to re-run.
-- Embeddings come from Voyage AI (voyage-4-lite, 1024 numbers per text).

create extension if not exists vector;

-- One vector per study-guide section (title + preview + text), and one per
-- tutor answer (for the near-duplicate check on upload).
alter table snippets   add column if not exists embedding vector(1024);
alter table agent_runs add column if not exists answer_embedding vector(1024);

-- Fast approximate nearest-neighbour search by cosine distance.
create index if not exists snippets_embedding_idx on snippets using hnsw (embedding vector_cosine_ops);
create index if not exists agent_runs_answer_embedding_idx on agent_runs using hnsw (answer_embedding vector_cosine_ops);

-- Search: sections for sale, in one course (or all courses when match_course
-- is null), closest in meaning first. similarity = 1 - cosine distance.
create or replace function match_snippets(
  query_embedding vector(1024),
  match_course text,
  exclude_author uuid,
  match_count int
) returns table (id text, similarity float)
language sql stable as $$
  select s.id, 1 - (s.embedding <=> query_embedding) as similarity
  from snippets s
  where s.embedding is not null
    and s.flagged_at is null
    and (match_course is null or s.course = match_course)
    and (exclude_author is null or s.author_id <> exclude_author)
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

-- Near-duplicate check for an upload: the closest existing section and the
-- closest past tutor answer.
create or replace function nearest_existing(query_embedding vector(1024))
returns table (kind text, id text, similarity float)
language sql stable as $$
  (select 'snippet', s.id, 1 - (s.embedding <=> query_embedding)
     from snippets s where s.embedding is not null
     order by s.embedding <=> query_embedding limit 1)
  union all
  (select 'answer', r.id::text, 1 - (r.answer_embedding <=> query_embedding)
     from agent_runs r where r.answer_embedding is not null
     order by r.answer_embedding <=> query_embedding limit 1);
$$;

-- Only our server (secret key) may call these, like every table here.
revoke execute on function match_snippets(vector, text, uuid, int) from public, anon, authenticated;
revoke execute on function nearest_existing(vector) from public, anon, authenticated;
