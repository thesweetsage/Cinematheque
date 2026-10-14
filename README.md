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

## Status

Phase 1 (the look, on sample data) is in progress: store front aisle, shelves with face-out VHS boxes,
the title page with a box you can turn, remote navigation, TV mode, store radio.
The catalogue is **sample data** until the Plex sync (phase 3) replaces it with the real library.
