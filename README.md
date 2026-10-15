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

### Signing in

Once Supabase is connected, every page needs the member to be signed in (one member: you).

1. Put your email in `MEMBER_EMAIL` in `.env.local`. Only that address can sign in.
2. In Supabase, **Authentication › URL Configuration**: set **Site URL** to the app's address on the NAS
   (e.g. `http://nas.local:3000`) and add `http://nas.local:3000/**` to **Redirect URLs**, so the email link comes back here.
3. In **Authentication › Email Templates**, add the code to both **Magic Link** and **Confirm signup**
   (the first sign-in uses Confirm signup), e.g. `<p>Or type this code: {{ .Token }}</p>`.
   The TV box can't open an email link, so on the TV you type the code with the remote.

The app then keeps its own signed session cookie for a year, renewed while you use it, so the TV box stays signed in.
Sign out on the Membership card. Supabase's built-in email sender allows only a few emails an hour; add your own SMTP
in Supabase if that gets in the way.

### Plex

1. Run `supabase/migrations/20261015120000_app_settings.sql` in the Supabase SQL Editor (it adds the table the
   Plex connection is kept in).
2. Open the **Membership** card, choose **Connect Plex**, then go to plex.tv/link on any device and type the code shown.
   If your account has one server it's picked straight away; otherwise choose it.
3. The first sync starts at once. After that the library syncs every hour while the app is running (and on **Sync now**):
   films and series are matched by their IMDb/TMDB ids (new ones are added from TMDB), every episode is stored,
   anything watched since the last sync is logged as a watch, titles that left Plex lose their ON PLEX sticker,
   and wishlist titles that arrived come off the wishlist. Titles Plex can't identify are listed under "not matched".

The app has to reach the Plex server: run it on the same computer or network. **Play on Plex** opens Plex Web,
or the Plex app on Android (its `plex://` link isn't documented by Plex, so check it on the TV box).

### Liner notes (Claude)

Put your Claude API key in `ANTHROPIC_API_KEY` in `.env.local`. The first time you open a title, the app finds its English
Wikipedia article (through Wikidata, by IMDb id) and has Claude write 4-6 "Did you know?" cards and 300-500 words of liner
notes from that article and the TMDB details only. They're saved as a draft with links to the article sections; read them
against the article, then **Mark as checked**. **Rewrite** asks again. Titles without a Wikipedia article get no notes.
Uses Claude Sonnet 5.5 (`NOTES_MODEL` in `src/lib/notes/write.ts`), roughly a few cents per title.

Every page reads the catalogue from the database (`src/lib/catalog.ts`, cached for a minute and refreshed when a title is added).
It falls back to the sample catalogue, with a SAMPLE DATA tag that says why, while the database isn't connected,
refuses access, or has no titles yet.

## Status

Phase 1 (the look) is done: store front aisle, shelves with face-out VHS boxes, the title page with a box you can turn,
remote navigation, TV mode, store radio.
Phase 2 is done: database schema, TMDB + OMDb lookups, generated spine colours, the Returns Slot search page
(preview any film or series as a VHS box, put it on the shelf), and the Store Front, Shelves and title pages reading
titles, ratings, recommendations, fact cards and editions from the database. Email login (Supabase Auth code or link, one member) guards every page and API route.
Phase 4 is done: title pages with TMDB reviews, a seasons shelf with episode ticks, and the liner-notes booklet
(fact cards and notes written by Claude from Wikipedia, drafts until you check them).
Phase 3 is done: Plex connection on the Membership card (plex.tv/link code), hourly library and watch sync, ON PLEX
stickers, Play on Plex, Continue watching on the Store Front, and the wishlist cleared by the sync.
