-- 007: handwritten study guides. Run once in the SQL Editor. Safe to re-run.
-- The original photos live in a PRIVATE storage bucket ("handwritten", created by the app);
-- buyers only ever get the transcribed text. These columns mark the guide and point at its photos.
alter table notes add column if not exists handwritten boolean not null default false;
alter table notes add column if not exists image_paths text[];
