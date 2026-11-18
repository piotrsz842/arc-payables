-- 006: authors can delete their own study guides (soft delete). Run once in the SQL Editor. Safe to re-run.
-- Deleting sets notes.deleted_at and takes every section off sale with the same flag reports use
-- (snippets.flagged_at). Rows are kept, so sales, earnings and cash-out history stay intact.
alter table notes add column if not exists deleted_at timestamptz;
