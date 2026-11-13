-- Arc Payables database schema.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- SECURITY MODEL: the browser never reads these tables directly.
-- Row Level Security (RLS) is ON for every table with NO policies, which means
-- "nobody gets in" through the public (publishable) key. Only our Next.js
-- server, using the secret key, can read/write — and it checks the user's role first.

-- 1. PROFILES: one row per logged-in person, with their role.
--    (Supabase Auth keeps emails/passwords in its own auth.users table.)
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null,
  role       text not null check (role in ('submitter', 'approver'))
);

-- 2. VENDORS: the allowlist. The ONLY place payout addresses come from.
create table vendors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  country         text not null,
  payout_address  text not null check (payout_address ~ '^0x[0-9a-fA-F]{40}$'),
  payout_currency text not null check (payout_currency in ('USDC', 'EURC')),
  category        text not null,
  created_at      timestamptz not null default now()
);

-- 3. BUDGETS: how much each category may spend per month (in USD).
create table budgets (
  category          text primary key,
  monthly_limit_usd numeric(18, 6) not null check (monthly_limit_usd >= 0)
);

-- 4. INVOICES: everything submitted, and where it is in the process.
create table invoices (
  id               uuid primary key default gen_random_uuid(),
  -- Our own short public reference, e.g. AP-1001. THIS is what goes in the
  -- onchain memo (never names, bank details, or the vendor's own numbering).
  ref              text not null unique,
  submitted_by     uuid not null references profiles (id),

  -- What the AI extracted from the invoice (untrusted input!)
  vendor_name      text not null,
  invoice_number   text not null,
  amount           numeric(18, 6) not null check (amount > 0),
  currency         text not null check (currency in ('USD', 'EUR')),
  due_date         date,
  category         text,
  -- A payout address written on the invoice, if any. We NEVER pay to it;
  -- we only compare it with the vendor's address on file to spot fraud.
  invoice_payout_address text,
  extraction       jsonb,          -- the AI's full raw answer, for auditing
  pdf_path         text,           -- where the original PDF is in Supabase Storage

  -- What our policy code decided
  vendor_id        uuid references vendors (id),  -- null = not on allowlist
  status           text not null default 'submitted' check (status in
                     ('submitted', 'needs_approval', 'approved', 'rejected', 'paying', 'paid', 'failed')),
  policy_flags     jsonb not null default '[]',   -- list of reasons it was flagged

  -- Payment, filled in later
  circle_tx_id     text,
  tx_hash          text,
  paid_at          timestamptz,    -- set ONLY by the QuickNode webhook ("trust the chain")

  created_at       timestamptz not null default now()
);

-- Speeds up duplicate detection (same vendor + same invoice number).
create index invoices_vendor_number on invoices (lower(vendor_name), invoice_number);

-- Our refs count up from AP-1001.
create sequence invoice_ref_seq start 1001;
alter table invoices alter column ref set default 'AP-' || nextval('invoice_ref_seq');

-- 5. AUDIT LOG: who did what, when, and why. Rows are only ever added.
create table audit_log (
  id          bigint generated always as identity primary key,
  invoice_id  uuid references invoices (id),
  actor_id    uuid references profiles (id),  -- null = the agent or a webhook
  action      text not null,                  -- e.g. 'submitted', 'flagged', 'approved'
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- Lock every table: RLS on, no policies = no access via the public key.
alter table profiles  enable row level security;
alter table vendors   enable row level security;
alter table budgets   enable row level security;
alter table invoices  enable row level security;
alter table audit_log enable row level security;
