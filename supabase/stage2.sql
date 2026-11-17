-- Stage 2: the agent's decision log.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- (Additive: it does not touch the old invoice tables; Stage 3 cleans those up.)
--
-- Same security model as everything else: RLS ON with NO policies, so only
-- our server (secret key) can read or write these tables.

-- 1. AGENT RUNS: one row per question the tutor agent works on.
create table agent_runs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  budget_usd  numeric(18, 6) not null check (budget_usd >= 0),  -- most this question may spend
  spent_usd   numeric(18, 6) not null default 0,
  status      text not null default 'running' check (status in ('running', 'finished', 'stopped_looping')),
  created_at  timestamptz not null default now()
);

-- 2. PURCHASE DECISIONS: every snippet the agent PROPOSED to buy, what the
--    checker decided, and why. Rows are only ever added (an audit trail),
--    except that a human answer or a payment result fills in the last columns.
create table purchase_decisions (
  id               bigint generated always as identity primary key,
  run_id           uuid not null references agent_runs (id) on delete cascade,
  snippet_id       text not null,            -- Stage 3 turns this into a real reference
  price_usd        numeric(18, 6) not null,
  agent_reason     text not null,            -- the agent's justification for buying

  -- The checker's decision
  verdict          text not null check (verdict in ('allow', 'block', 'ask_human')),
  rule             text not null,            -- which check decided, e.g. 'relevance', 'duplicate', 'loop'
  checker_reason   text not null,            -- plain-English explanation shown to the user
  relevance        jsonb,                    -- the isolated relevance model's raw answer (if it ran)

  -- Filled in afterwards
  human_decision   text check (human_decision in ('approved', 'denied')),
  paid             boolean not null default false,
  gateway_transfer_id text,                  -- Circle Gateway's reference for the payment

  created_at       timestamptz not null default now()
);

create index purchase_decisions_run on purchase_decisions (run_id, created_at);

alter table agent_runs         enable row level security;
alter table purchase_decisions enable row level security;
