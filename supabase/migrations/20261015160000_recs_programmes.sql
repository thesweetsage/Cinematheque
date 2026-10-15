-- The Cinematheque: recommendations (phase 5) and programmes (phase 6).
-- Run once in the Supabase SQL Editor after the earlier migrations.

-- Recommendations: where each one came from, and the title that led to it ("Because you watched …").
alter table recommendations add column if not exists source text not null default 'tmdb'; -- tmdb | claude
alter table recommendations add column if not exists seed_title_id uuid references titles (id) on delete set null;
alter table recommendations add column if not exists updated_at timestamptz not null default now();
-- One row per title: a new run updates it, and the member's thumbs/dismissals stay attached to it.
delete from recommendations a using recommendations b
  where a.title_id = b.title_id and (a.created_at, a.id) < (b.created_at, b.id);
create unique index if not exists recommendations_title_idx on recommendations (title_id);

-- Programmes: when an item was ticked off (the rental card stamps the date), and whether an edition's essay is checked.
alter table programme_items add column if not exists done_at timestamptz;
alter table programmes add column if not exists essay_status note_status not null default 'draft';
create index if not exists programme_items_title_idx on programme_items (title_id);

grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;
