# The Cinematheque

A personal 80s video store for everything on my Plex server (films and series): watch history, recommendations (popular + deep cuts), title pages with facts and essays, and programmes (editions, festivals, 31 Days of ___, series marathons, curricula, retrospectives). Single user (me).

It will run on my NAS next to Plex (for now, while testing, it runs on my PC) and is used mainly **on the projector through a Xiaomi Android TV box, with the remote**. It also works in a normal browser.

The full original plan is in `docs/BUILD_PLAN.md`. Where this file and the plan disagree, this file wins.

## Stack
Next.js 16 App Router, TypeScript, Tailwind 4 (tokens) + plain CSS modules for the store look, Supabase (Postgres, auth, storage, cron). Docker on the NAS next to Plex (on my PC while testing).
No GSAP: motion is CSS so it stays smooth on the TV box. Add a library only if CSS can't do it.

## TV app (Android TV / Google TV)
- The web app is the product. A small Android TV wrapper app (Capacitor or a plain WebView app) opens the app's address (the NAS, or my PC while testing) full screen, with a 320x180 home-screen banner. Installed by sideloading (Downloader app), not the Play Store.
- **Remote first.** Every screen works with arrows, OK (Enter) and Back. Focus is always visible (white ring + pink glow). Arrow keys move to the nearest focusable item in that direction (`src/components/RemoteNav.tsx`). Back closes the top overlay, otherwise goes to the previous page.
- **TV mode** (auto on when there is no fine pointer, switch in Settings): bigger type (zoom 1.25), 3vw safe margins for overscan, lighter effects (no scanline overlay, no backdrop blur).
- Performance budget for the box: no canvas noise loops, no large blurs, few simultaneous transforms, images at w342 for covers.
- "Play on Plex" and "Open in Stremio" open the Plex and Stremio Android TV apps through their deep links.

## Artwork
- Covers come from Plex (its own poster for each item) or TMDB `poster_path`. Backdrops from TMDB for stills.
- **Spines are generated, never sourced:** background = darkest dominant colour of the poster, accent = most vivid colour, the TMDB transparent title logo (`/images` → `logos`, png) runs down the spine, plus the year and format. If the logo is dark, the spine is light. No logo → title set in type.
- **Covers first.** Shelves show VHS boxes face out, turned slightly so the spine shows **on the left**. Pure spine rows are scenery only, never the way to pick a film.
- Colours and logo brightness are computed once when a title is synced (sharp) and stored with the title.
- Credit TMDB wherever its images show. Artwork is never committed to the repo (`public/art/` is git-ignored; `npm run art` fetches the sample set).

## The VHS box
`src/components/VhsBox.tsx` is the core visual. A real 3D box (CSS transforms): front = poster, left = spine, back = synopsis, stills, credits, runtime, barcode, shop label. Case: cardboard sleeve or plastic clamshell. Wear: mint, rented (shop sticker, price tag, scuffed corners), well loved (faded, creases, residue, tape). The room and boxes never move on their own: a box only turns when chosen (focus lifts it slightly).

## Data model
- titles: id, kind (movie|series), tmdb_id, imdb_id, title, year, runtime, seasons_count, genres, keywords, director_or_creator, country, language, poster_url, backdrop_url, logo_url, spine_bg, spine_accent, logo_dark, plex_rating_key, on_plex, ratings (imdb, rt, metacritic), metadata_updated_at
- episodes: id, title_id, season, episode, name, runtime, plex_rating_key
- watches: id, title_id, episode_id, watched_at, source (plex|manual), rating, note. Unique on (title_id, episode_id, date, source)
- title_notes: title_id, fact_cards (json), liner_notes, sources, status (draft|checked)
- programmes: id, type (edition|festival|days31|marathon|curriculum|retrospective|family_tree|time_capsule|essay_series), title, slug, theme, essay, start_date, end_date, accent_color, poster_url, status (draft|live|archived), spine_number, source_note
- programme_items: programme_id, title_id, episode_id, position, chapter, slot_date, programme_note, done
- awards: programme_id, category, title_id, note
- title_links: from_title_id, to_title_id, kind (inspired|influenced|pairs_with), note, verified
- recommendations: title_id, lane (popular|deep_cut), reason, score, created_at, feedback (up|down|dismissed)
- wishlist: title_id, added_at, note
- pending_checks: title_id, episode_id, opened_at
Watched is computed from watches. A series is finished when every episode has a watch.

## Integrations
- TMDB: films + series search, details, credits, keywords, external_ids, images (posters, backdrops, logos), reviews, recommendations, similar, discover. Credit TMDB in the footer.
- No streaming services: everything is watched locally from Plex, so no "where to watch" or watch-provider data. A title that isn't on Plex gets "Add to wishlist".
- OMDb: ratings by IMDb ID (IMDb, Rotten Tomatoes, Metacritic). Cache per title.
- Wikipedia: find the article via Wikidata by IMDb ID; text is the only source for fact cards and liner notes.
- Plex (library + history): local API with X-Plex-Token. Hourly sync of movie and TV sections with includeGuids=1 and all episodes; new lastViewedAt = new watch. Wishlist cleared when a title appears.
- Stremio: add-on at /api/stremio (stremio-addon-sdk), one catalogue per live programme, movies + series, IMDb IDs. Open in Stremio → pending_checks → "Did you finish it?" prompt.
- No Letterboxd, no Trakt.
- Claude API: server routes only, JSON output, only facts from provided sources, drafts until I mark them checked.

## Design
80s video store at night, lit like the reference photo: lavender/periwinkle light, white shelving with pink neon underglow, navy tile wall, cyan "VIDEO" block sign over a pink script name, framed posters, arcade carpet (magenta dots, yellow squiggles, purple triangles).
Tokens: bg #0B0920, wall #110D36, panel #151239, edge #3A3471, text #EFEBFC, muted #A09ACB, lavender #B9B2FF, magenta #FF4FB8, cyan #7EE6FF, yellow #FFE38A, orange #FF9A5C.
Reading skin (liner notes, booklets): cream #F4EFE6, ink #1A1714, printed red #B3261E, Fraunces + Newsreader.
Fonts: Big Shoulders Display (sign, headings), Mr Dafoe (neon script), Bungee (box titles, stickers), VT323 (on-screen labels, buttons), IBM Plex Sans Condensed (body), Permanent Marker (staff cards).
Effects: the walk-in once a day (see Store front), neon glow on signs. No scanlines or TV-line filters anywhere: they hide the covers. All motion off under prefers-reduced-motion and the Settings switch. Nothing drifts or follows the pointer.
Store front: photographic, not illustrated. Walk-in footage (`public/store/walk-in.mp4`, see `docs/WALK_IN.md`) ends facing the new releases wall, then the live shelf of big face-out tapes sits in front of that end frame (`public/store/shelf.jpg`). Tapes are big: about a sixth of the screen width each.
Store radio: original synthwave generated live with Web Audio; never autoplays.
Pages: Store Front, Shelves, The Box (title), Festival Wall + Programme, Back Wall, Rental Card, Marathon card, Course Shelf, Director's Shelf, Family tree, Wishlist, Returns Slot (search), Membership Card (settings).
Banned: purple-blue gradients, soft rounded cards with shadows, Inter/system fonts, emoji icons, centred hero + three feature cards, anything that moves without being asked.

## Rules for the AI
- Read this file first. List the files you'll change before coding.
- This Next.js version differs from training data: check `node_modules/next/dist/docs/` before using an API.
- One feature per session. Don't refactor unrelated code.
- Secrets only in .env.local, used server side only. Never commit artwork or keys.
- Every new screen must be fully usable with arrows + OK + Back before it's done.
- After any UI change, check it with Playwright screenshots at 1920x1080 (TV), 1366x900 and 400px wide.
