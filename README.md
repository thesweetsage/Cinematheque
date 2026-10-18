# The Cinematheque

A personal 80s video store for my Plex library, built for the projector and a TV remote.
Read `BRIEF.md` first; the full plan is in `docs/BUILD_PLAN.md`.

## Run it

```bash
npm install
cp .env.local.example .env.local   # add your TMDB_API_KEY
npm run art                        # fetches sample covers, logos and backdrops into public/art (not committed)
npm run dev                        # http://localhost:3001 (npm start also uses 3001)
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
2. In Supabase, **Authentication › URL Configuration**: set **Site URL** to the app's address on your network
   (the PC's local IP while testing, the NAS's later, e.g. `http://192.168.1.20:3000`, so the TV box can reach it) and add `http://192.168.1.20:3000/**` to **Redirect URLs**, so the email link comes back here.
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

### The walk-in

The Store Front opens with a 6-second walk into the store, once a day (`public/store/walk-in.mp4`, ending on
`public/store/shelf.jpg`). It's a 3D store rendered in code with real TMDB covers on the tapes. Because it shows TMDB
artwork it isn't in git: copy the two files into the project's `public/store/` folder on the machine running the app (your PC for now, the NAS later) before building, or render them with
`scripts/walkin/` (steps in `docs/WALK_IN.md`). Without them the Store Front shows a still from Tonight's pick instead.

The **Festival wall** has a second clip from the same store: a 2.6-second turn from the new releases wall to the festival
board on the right wall (`public/store/pan.mp4`), once a day on your first visit (OK or Back skips it). Its end frame,
`public/store/wall.jpg`, stays behind this month's poster and flyer, so they sit pinned on the cork. Same rules: not in
git, copy both files in or render them (`docs/WALK_IN.md`). Without them the wall looks as before.

### Recommendations (staff cards)

Run `supabase/migrations/20261015160000_recs_programmes.sql` once in the SQL Editor (it also adds what programmes need).
Every night (the hourly timer asks; it runs once the last run is 20 hours old) the app rebuilds your taste profile from
your Plex watches and ratings, finds candidates from TMDB (recommendations and similar titles for your recent favourites,
Discover on your top genres and keywords), drops anything you've watched, own or turned down, and writes the
**Popular Picks** and **Deep Cuts** lanes on the Store Front, each card with its reason. Once a week Claude adds ten deep cuts
with reasons (`RECS_MODEL` in `src/lib/recs/claude.ts`); each one is looked up on TMDB and dropped if it isn't found.
Thumbs up / down on a card count towards the next night. **Write new cards now** on the Membership card runs it at once.
Also new: "Because you watched…" and "On your shelf, unwatched" rows, TMDB's *More like this* on every title page, and the
**Coming soon** wishlist board (titles come off it by themselves when the Plex sync finds them).

### The Library and the Shelves

**Library** lists everything on your shelves in one place, Films and Series separately: A to Z (with letter markers),
newest in, or by year, and narrowed to any genre. 40 tapes a page. **Shelves** has the same Films / Series switch, with
genre aisles inside each (series get their own Horror, Comedy, Sci-Fi… aisles).

Every screen works with the remote alone: arrows move between everything, and in a text box Left/Right move the cursor
until it reaches the edge, then move on to the next control.

### Programmes

The **Festival wall** holds the programmes:

- **Start a programme** builds one for you (films only; series get marathons later): choose Festival or 31 Days, then a genre
  and/or a decade, or *Surprise me*, or type any theme. The films come from all of TMDB, with the ones on your Plex mixed in and
  unwatched first; the others are marked "not on Plex" and can go on the wishlist. With a Claude key, Claude curates it, names it and
  writes the booklet and notes (typed themes need it; every suggestion is checked on TMDB; `CURATOR_MODEL` in `src/lib/autoProgramme.ts`).
  It builds in the background (up to a minute), so the rest of the app stays usable. Everything can be edited afterwards.
- **Festivals:** any theme and dates. A poster, a booklet, a schedule with tick boxes, and jury awards once closing night has passed.
- **31 Days of ___:** a rental card with a box per day, stamped on each day you watched one of its titles, and a streak. When it ends, an end poster you can print.
- **Editions:** on any title's page, **Induct into the collection** gives it the next spine number (No. 001, No. 002…) and an essay
  page: draft it with Claude (from Wikipedia, the checked liner notes and your own ratings and notes; `ESSAY_MODEL` in
  `src/lib/editionEssay.ts`), edit it, mark it checked, and pair it with other editions.

Festival and 31 Days items tick themselves when the Plex sync logs a watch of that title on or after the start date.

### Stremio

The app is also a Stremio add-on: every running festival and 31 Days is a catalogue in Stremio, in programme order, plus
**The Cinematheque collection** (your editions). It lists titles by IMDb id; Stremio fills in the details and your own
stream add-ons do the playing. Titles without an IMDb id are left out.

- **Install (once, on the PC; nothing to type on the TV box):** open the Membership card on the PC. It shows the add-on
  address with the PC's home-network address in it (`http://192.168.x.x:3001/api/stremio/.../manifest.json`). Press
  **Copy the address**, then in **Stremio on the PC**, signed in with the same Stremio account as the TV box, open
  **Add-ons**, paste it into the search box at the top and press **Install**. Stremio keeps add-ons in your account, so
  it appears on the TV box by itself. Stremio on the PC is only needed for that one install. After that the box reads
  the catalogues straight from the Cinematheque server: your PC while testing (so it has to be switched on with
  `npm start` running; if Windows asks whether Node.js may use the network, allow it on private networks), the NAS
  later, which is always on. When it moves to the NAS the address changes: install the new one once and remove the old.
  The address carries a private key (made from `SESSION_SECRET`); keep it to yourself. Changing `SESSION_SECRET`
  changes it, and you install it again. (A one-press "Install in Stremio" button appears only when the app is on
  https: Stremio turns `stremio://` links into https.)
- **Open in Stremio** on a box opens the title in the Stremio app. The next time you come back to the app (a few minutes
  later or more), it asks **Did you finish it?**: *Yes* (then your stars) logs a watch and ticks it off any running
  programme, *Not yet* asks again next time, *Dropped it* forgets it. Back on the remote is *Not yet*.
- **http or https:** Stremio's documentation says add-ons must be on https unless they run on the same device.
  Many people use a plain `http://<PC address>:3001/...` address on Android TV without trouble, so try that first. If
  Stremio refuses it, put the app behind https: a free Cloudflare Tunnel or Tailscale Funnel to port 3001, or a reverse
  proxy with a certificate on the NAS later. Then open the Membership card through that https address and install from there.

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
Phase 5 is done: the nightly taste profile and recommendations (Popular Picks, Deep Cuts, Claude's weekly deep cuts checked
against TMDB), thumbs up/down, Because you watched, More like this, and the Coming soon wishlist.
Phase 6 is done: Editions with spine numbers and essays, Festivals with booklet, schedule, tick-off and jury awards, and
31 Days rental cards with stamps and a streak; items tick themselves from Plex watches.
The walk-in footage is rendered (a 3D store with real covers; kept out of git, see `docs/WALK_IN.md`).
Phase 7 is done: the walk-in on the Store Front and the pan from the shelves to the festival board on the Festival wall.
Phase 8 is done: the Stremio add-on (festivals, 31 Days and the collection as catalogues), Open in Stremio and Did you finish it?
