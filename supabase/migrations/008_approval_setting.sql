-- 008: each student chooses when the tutor must ask before buying.
-- "Ask me before any single purchase over $X" (default $0.005). Run once in the SQL Editor. Safe to re-run.
alter table profiles add column if not exists approval_threshold_usd numeric(18, 6) not null default 0.005
  check (approval_threshold_usd >= 0 and approval_threshold_usd <= 0.01);
