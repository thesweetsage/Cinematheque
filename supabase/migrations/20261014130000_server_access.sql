-- The Cinematheque: let the app's server reach the tables, and mark which titles are on the shelves.
-- Newer Supabase projects no longer grant table access to the API roles automatically, so the secret key
-- (service_role) got "permission denied" on every table. Row-level security still has no policies, so the
-- publishable key (anon, authenticated) stays locked out.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

revoke all on all tables in schema public from anon, authenticated;

-- A title can be in the database without being on the shelves (a recommendation, a wishlist item).
-- Until the Plex sync (phase 3) sets on_plex, titles added in the Returns Slot are marked here.
alter table titles add column if not exists in_library boolean not null default false;
create index if not exists titles_in_library_idx on titles (in_library);
