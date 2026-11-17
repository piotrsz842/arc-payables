-- Notes by Students: full database schema for a FRESH Supabase project.
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- (An existing project from earlier stages runs supabase/migrations/ instead.)
--
-- SECURITY MODEL: the browser never reads these tables directly.
-- Row Level Security (RLS) is ON for every table with NO policies, so the
-- public (publishable) key can read nothing. Only our Next.js server, using
-- the secret key, reads and writes, after checking who the user is.

-- PROFILES: one per person. Everyone can both write notes and ask questions.
create table profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  display_name         text not null,
  wallet_id            text not null,   -- Circle wallet on Arc testnet, created at signup
  wallet_address       text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  free_questions_left  int not null default 3 check (free_questions_left >= 0),
  created_at           timestamptz not null default now()
);

-- NOTES and their SNIPPETS (what the tutor agent buys).
create table notes (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles (id) on delete cascade,
  course      text not null,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table snippets (
  id          text primary key default gen_random_uuid()::text,
  note_id     uuid not null references notes (id) on delete cascade,
  author_id   uuid not null references profiles (id) on delete cascade,
  position    int not null,
  course      text not null,
  title       text not null,            -- free preview
  summary     text not null,            -- free preview
  content     text not null,            -- paid
  price_usd   numeric(18, 6) not null check (price_usd > 0),
  created_at  timestamptz not null default now()
);
create index snippets_course on snippets (lower(course));

-- AGENT RUNS: one per question the tutor works on.
create table agent_runs (
  id             uuid primary key default gen_random_uuid(),
  question       text not null,
  asked_by       uuid references profiles (id) on delete set null,
  budget_usd     numeric(18, 6) not null check (budget_usd >= 0),
  spent_usd      numeric(18, 6) not null default 0,
  free_question  boolean not null default false,
  charged_usd    numeric(18, 6) not null default 0,
  answer         text,
  status         text not null default 'running' check (status in ('running', 'finished', 'stopped_looping')),
  created_at     timestamptz not null default now()
);

-- PURCHASE DECISIONS: the checker's decision log (every proposal, before money moves).
create table purchase_decisions (
  id                   bigint generated always as identity primary key,
  run_id               uuid not null references agent_runs (id) on delete cascade,
  snippet_id           text not null,
  price_usd            numeric(18, 6) not null,
  agent_reason         text not null,
  verdict              text not null check (verdict in ('allow', 'block', 'ask_human')),
  rule                 text not null,
  checker_reason       text not null,
  relevance            jsonb,
  human_decision       text check (human_decision in ('approved', 'denied')),
  paid                 boolean not null default false,
  gateway_transfer_id  text,
  created_at           timestamptz not null default now()
);
create index purchase_decisions_run on purchase_decisions (run_id, created_at);

-- LEDGER: every dollar movement for a person. Balance = sum(amount_usd).
create table ledger_entries (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references profiles (id) on delete cascade,
  kind                 text not null check (kind in ('sale', 'spend', 'topup', 'payout')),
  amount_usd           numeric(18, 6) not null,
  run_id               uuid references agent_runs (id) on delete set null,
  snippet_id           text references snippets (id) on delete set null,
  gateway_transfer_id  text unique,   -- one Gateway payment can never be credited twice
  detail               jsonb,
  created_at           timestamptz not null default now()
);
create index ledger_user on ledger_entries (user_id, created_at);

alter table profiles           enable row level security;
alter table notes              enable row level security;
alter table snippets           enable row level security;
alter table agent_runs         enable row level security;
alter table purchase_decisions enable row level security;
alter table ledger_entries     enable row level security;
