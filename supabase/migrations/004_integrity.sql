-- 004: content integrity (own-work confirmation, reports) and answer ratings.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- The author ticked "this is my own work in my own words" when uploading.
alter table notes add column if not exists own_work_confirmed boolean not null default false;

-- A reported snippet is FLAGGED: it stops being sold (search and the paid
-- endpoint skip it) until someone reviews the report.
alter table snippets add column if not exists flagged_at timestamptz;

create table if not exists snippet_reports (
  id           bigint generated always as identity primary key,
  snippet_id   text not null references snippets (id) on delete cascade,
  reporter_id  uuid references profiles (id) on delete set null,
  reason       text not null check (reason in (
                 'copies_course_materials', 'instructor_removal_request', 'ai_generated',
                 'wrong_or_misleading', 'other')),
  details      text,
  status       text not null default 'open' check (status in ('open', 'upheld', 'dismissed')),
  created_at   timestamptz not null default now()
);
create index if not exists snippet_reports_snippet on snippet_reports (snippet_id);

-- Thumbs up / down on a tutor answer. One rating per question (run).
-- Per-author quality = ratings of the answers that used their snippets.
create table if not exists answer_ratings (
  run_id      uuid primary key references agent_runs (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  rating      smallint not null check (rating in (-1, 1)),
  created_at  timestamptz not null default now()
);

-- Same rule as every other table: RLS on, no policies (only our server reads/writes).
alter table snippet_reports enable row level security;
alter table answer_ratings  enable row level security;
