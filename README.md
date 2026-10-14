# The Cinematheque

A personal 80s video store for my Plex library, built for the projector and a TV remote.
Read `BRIEF.md` first; the full plan is in `docs/BUILD_PLAN.md`.

## Run it

```bash
npm install
cp .env.local.example .env.local   # add your TMDB_API_KEY
npm run art                        # fetches sample covers, logos and backdrops into public/art (not committed)
npm run dev                        # http://localhost:3000
```

Use the arrow keys, Enter and Backspace to drive it like the TV remote.

## Database (Supabase)

1. In the Supabase dashboard, open **SQL Editor** and run each file in `supabase/migrations/` once, in name order:
   - `20261014120000_init.sql` creates the tables.
   - `20261014130000_server_access.sql` grants the server key access to them (newer Supabase projects don't do this
     automatically, so without it every read fails with "permission denied") and adds `titles.in_library`.
2. Put the project URL in `NEXT_PUBLIC_SUPABASE_URL` and the secret key (`sb_secret_…`, or the legacy `service_role` key) in `SUPABASE_SECRET_KEY`.
   The secret key stays on the server; row-level security blocks the public key from every table.

Every page reads the catalogue from the database (`src/lib/catalog.ts`, cached for a minute and refreshed when a title is added).
It falls back to the sample catalogue, with a SAMPLE DATA tag that says why, while the database isn't connected,
refuses access, or has no titles yet.

## Status

Phase 1 (the look) is done: store front aisle, shelves with face-out VHS boxes, the title page with a box you can turn,
remote navigation, TV mode, store radio.
Phase 2 (in progress): database schema, TMDB + OMDb lookups, generated spine colours, the Returns Slot search page
(preview any film or series as a VHS box, put it on the shelf), and the Store Front, Shelves and title pages reading
titles, ratings, recommendations, fact cards and editions from the database. Still to do in phase 2: email login.
Phase 3 (the Plex sync) fills the shelves with the real library.
