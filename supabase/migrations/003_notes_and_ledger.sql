-- Stage 3: users with hidden wallets, notes → snippets, and the money ledger.
-- For the EXISTING database (already has 002). Run once in the Supabase
-- SQL Editor. A fresh project instead runs supabase/schema.sql.
--
-- This REMOVES the old accounts-payable tables (and their demo rows).

-- 1. Old project, gone.
drop table if exists audit_log, invoices, budgets, vendors cascade;
drop sequence if exists invoice_ref_seq;
drop table if exists profiles cascade;

-- 2. PROFILES: one per person. Everyone can both write notes and ask questions.
create table profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  display_name         text not null,
  -- Their Circle wallet on Arc testnet, created at signup. Never shown on main screens.
  wallet_id            text not null,
  wallet_address       text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  free_questions_left  int not null default 3 check (free_questions_left >= 0),
  created_at           timestamptz not null default now()
);

-- 3. NOTES and their SNIPPETS (the things the tutor agent buys).
create table notes (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles (id) on delete cascade,
  course      text not null,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table snippets (
  id          text primary key default gen_random_uuid()::text,  -- text so demo ids like 'demo-1' fit
  note_id     uuid not null references notes (id) on delete cascade,
  author_id   uuid not null references profiles (id) on delete cascade,
  position    int not null,             -- order within the note
  course      text not null,
  title       text not null,            -- free preview
  summary     text not null,            -- free preview
  content     text not null,            -- paid
  price_usd   numeric(18, 6) not null check (price_usd > 0),
  created_at  timestamptz not null default now()
);
create index snippets_course on snippets (lower(course));

-- 4. Who asked each question, what it cost them, and the answer.
alter table agent_runs
  add column asked_by      uuid references profiles (id) on delete set null,
  add column free_question boolean not null default false,
  add column charged_usd   numeric(18, 6) not null default 0,
  add column answer        text;

-- 5. THE LEDGER: every dollar movement for a person is one row.
--    Balance = sum(amount_usd). Earnings = sum of 'sale' rows.
--      sale    +  an author's snippet was bought (written by the seller endpoint)
--      spend   -  a question used paid snippets (unless it was a free question)
--      topup   +  a student added money
--      payout  -  an author cashed out (Stage 4)
create table ledger_entries (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references profiles (id) on delete cascade,
  kind                 text not null check (kind in ('sale', 'spend', 'topup', 'payout')),
  amount_usd           numeric(18, 6) not null,
  run_id               uuid references agent_runs (id) on delete set null,
  snippet_id           text references snippets (id) on delete set null,
  -- For sales: Circle Gateway's reference. UNIQUE so one payment can never be credited twice.
  gateway_transfer_id  text unique,
  detail               jsonb,
  created_at           timestamptz not null default now()
);
create index ledger_user on ledger_entries (user_id, created_at);

alter table profiles       enable row level security;
alter table notes          enable row level security;
alter table snippets       enable row level security;
alter table ledger_entries enable row level security;
