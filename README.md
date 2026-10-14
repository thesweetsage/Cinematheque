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

1. In the Supabase dashboard, open **SQL Editor**, paste `supabase/migrations/20261014120000_init.sql` and run it once.
2. Put the project URL in `NEXT_PUBLIC_SUPABASE_URL` and the secret key (`sb_secret_…`) in `SUPABASE_SECRET_KEY`.
   The secret key stays on the server; row-level security blocks the public key from every table.

Until both are set the app runs on the sample catalogue, and "Add to my library" says the database isn't connected.

## Status

Phase 1 (the look, on sample data) is in progress: store front aisle, shelves with face-out VHS boxes,
the title page with a box you can turn, remote navigation, TV mode, store radio.
Phase 2 (in progress): database schema, TMDB + OMDb lookups, generated spine colours, and the Returns Slot
search page, which previews any film or series as a VHS box and adds it to the library once the database is connected.
The catalogue is **sample data** until the Plex sync (phase 3) replaces it with the real library.
