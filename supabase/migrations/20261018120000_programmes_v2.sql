-- The Cinematheque: v2 programmes (phase 9): marathons, curricula, retrospectives, family trees, year in a decade,
-- essay series. Run once in the Supabase SQL Editor after the earlier migrations.

-- Type-specific details that don't need their own columns: a marathon's portion size, a curriculum's lines that
-- TMDB couldn't find, a retrospective's director, themes and Top 10, a year's albums, events and fashion notes,
-- the Plex collections a programme was copied to.
alter table programmes add column if not exists extras jsonb not null default '{}';

-- Essay series: one essay per title (a final girl per era), drafted by Claude, checked by the member.
alter table programme_items add column if not exists essay text;
alter table programme_items add column if not exists essay_status note_status not null default 'draft';

-- Family trees read a title's links in both directions.
create index if not exists title_links_to_idx on title_links (to_title_id);

grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;
