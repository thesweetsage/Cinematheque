# The Cinematheque: Build Plan

Oct 14, 2026 · @Diana

## What it is

The Cinematheque is your personal 80s video store for everything on your Plex server, both films and series. It knows what you've watched, recommends what to watch next (popular picks and deep cuts), gives every title its own facts and essays, and turns watching into programmes: festivals, 31-day challenges, series marathons and full viewing curricula like the *In Search of Darkness* film lists.

**Plex is the centre.** It's your library and your watch history. Stremio gets your programmes through your own Cinematheque add-on, and anything you open there is logged with a "Did you finish it?" prompt. No Trakt or Letterboxd accounts needed.

**v1 (build first):** films and series from Plex with watch history, title pages with metadata, ratings and fact cards, editions, festivals, 31 Days of \_\_\_, recommendations, the video store design and intro animation.

**v2:** series marathons, curricula, director retrospectives, family tree, year in a decade, final girls archive, the Stremio add-on, generated posters.

**Stack:** Next.js (App Router) + Supabase (Postgres, auth, storage, cron) + Tailwind, built with Claude Code. Hosted in Docker on your NAS next to Plex (simplest for reaching Plex) or on Vercel.

## Architecture

&#91;embedded content: Cinematheque architecture · 3 data sources, 2 players\]

TMDB, OMDb and Wikipedia supply metadata, ratings and facts; Claude turns them into fact cards, essays and deep-cut suggestions. Plex is both your library and your watch history. Stremio gets your programmes through your own add-on, and anything you open there comes back through the "Did you finish it?" prompt.

## Programme types

Every programme is a list of titles in an order, with a theme and your progress. The types only change the layout and the rules.

**What an Edition is.** Criterion releases each film as a numbered edition with a booklet essay inside: a few pages on why the film matters, its context and what to look for. In the Cinematheque, an Edition is your hall of fame. When a film or series becomes one of your all-time favourites, you "induct" it: it gets the next spine number (`No. 001`, `No. 002`…), a place on the Staff Picks shelf, and an essay. The essay is about 400–600 words: what it is, why it matters, what to notice, and your take. Claude drafts it from the title's facts and your notes, and you can edit it, shorten it or skip it. So the collection grows into your personal canon, one numbered box at a time.

| Type | What it is | Rules and features | Version |
| --- | --- | --- | --- |
| Edition | Your hall of fame, one title per edition | Spine number, essay, "pairs with" other editions | v1 |
| Festival | A monthly theme of any kind: rom-coms, medieval, fantasy, one decade, one country… | Programme booklet, poster on the store wall, schedule, tick-off as you watch, jury awards at the end | v1 |
| 31 Days of \_\_\_ | A one-a-day challenge on any theme: horror in October, rom-coms in February, anime films… | 31 slots on a rental card, daily stamp, streak, end poster | v1 |
| Series marathon | A plan to finish a series you keep dropping | Episodes split into daily or weekly portions, rental card progress, nudge on the Store Front when you fall behind | v2 |
| Curriculum | A full viewing course from a source, e.g. every film covered in *In Search of Darkness* Parts I–III | Paste or import the list, grouped into chapters (year, part), progress bar per chapter, completion seal | v2 |
| Retrospective | A director's filmography as a course | Viewing order, themes to watch for, Top 10 ranking at the end | v2 |
| Family tree | A title plus what inspired it and what it influenced | Graph view, links you verify, notes on what you noticed | v2 |
| Year in a decade | One year (1974, 1997…) as a month-long programme | Films and series from that year plus albums, events and fashion notes | v2 |
| Final girls archive | Chronological essays on horror heroines across decades | Essay series, one title per era | v2 |

**Festival vs 31 Days:** a festival is a curated monthly programme (6–12 titles, a booklet, awards). 31 Days is a daily habit challenge. Both can use any theme, so you can run a "medieval" festival and "31 Days of Rom-Coms" in the same month.

## Recommendations

The app builds a taste profile from what you watch on Plex and your ratings, then suggests films and series in two lanes: **Popular Picks** (well-loved titles you'll probably enjoy) and **Deep Cuts** (niche, older, foreign or overlooked titles). Every suggestion says why it was picked, whether it's already on your Plex, and where to watch it if not.

**How it works**

1. **Taste profile (nightly).** From your watches and ratings: top genres, TMDB keywords ("slasher", "enemies to lovers", "time loop"), directors, decades, countries, and series you finished vs dropped. Recent watches count more.
2. **Candidates.** For your recent and highest-rated titles, TMDB's recommendations and similar-titles endpoints, plus TMDB Discover searches on your top keywords and genres.
3. **Two lanes.**
   - Popular Picks: candidates with lots of votes and a high average.
   - Deep Cuts: candidates with few votes but a strong average, older decades, non-English titles. Claude also suggests 10 deep cuts a week with a reason each ("you rated three 70s folk horrors five stars"). The app looks every suggestion up on TMDB and drops any it can't find, so nothing invented gets through.
4. **Filtering.** Hide anything you've watched, already have on Plex (shown separately as "On your shelf, unwatched"), or dismissed.

**What you see**

- A **"Staff Recommends" wall** on the Store Front: handwritten-style staff cards on VHS boxes, one lane per row.
- Per suggestion: poster, year, ratings, the reason, an **ON PLEX** sticker or **Add to Wishlist**, and **Where to watch** (streaming, rental or purchase in Portugal, from TMDB's watch-provider data).
- "More like this" on every title page, and "Because you watched…" rows for your recent favourites.
- A **Wishlist** page: titles you want to add to your Plex library, ticked off automatically when they appear in the next Plex sync.
- Thumbs up/down on suggestions, which feed back into the profile.

## Title pages

Every film and series gets a full page ("The Box") with metadata, ratings, reviews, fact cards and a short essay, so browsing your library feels like reading the back of a VHS box and the booklet inside.

| Block | What's in it | Source |
| --- | --- | --- |
| Box front | Poster as a worn VHS box, title, year, runtime or seasons/episodes | TMDB |
| Credits | Director/creator, writers, main cast, country, language, studio | TMDB |
| Ratings | IMDb rating, Rotten Tomatoes (films only), Metacritic, your stars | OMDb, your rating |
| Synopsis | Short plot, no spoilers | TMDB |
| Reviews | 2–3 user reviews (expand to read) | TMDB reviews |
| Fact cards | 4–6 short "Did you know?" cards: production, casting, release, legacy | Claude, summarised from the title's Wikipedia article, with a link to it |
| Liner notes | A 300–500 word mini essay: context, why it matters, what to notice | Claude, from the same sources (Editions get the longer essay) |
| On your Plex | ON PLEX sticker, Play on Plex, Open in Stremio, your watch history | Plex, Stremio, your watches |
| Where to watch | Streaming, rental, purchase options in Portugal | TMDB watch providers |
| Seasons (series) | Season shelf, episode list with watched ticks, "Start a marathon" | TMDB, Plex |
| More like this | 6 recommendations with reasons | Recommendations engine |

**Generated once, kept forever:** fact cards and liner notes are generated the first time you open a title, saved, and shown as "draft" until you mark them checked. A Regenerate button sits next to each.

## Design

The whole app is an 80s neighbourhood video store after closing time, in the spirit of the *In Search of Darkness* documentaries: neon signs, VHS boxes on shelves, CRT screens and rental stickers. The one exception is the festival programme booklet and the essays, which stay editorial and print-like, like a programme you'd pick up at the counter.

**Two skins**

| Token | Main skin ("Video Store") | Booklet skin ("Programme") |
| --- | --- | --- |
| Used on | Every page except the reading pages below | Festival programme booklet, edition essays, liner notes, final girls essays |
| Background | Midnight blue-black `#0B0A12`, with a faint carpet/grid texture | Warm cream `#F4EFE6`, faint paper grain |
| Text | CRT off-white `#EDE6D6` | Ink black `#1A1714` |
| Muted text | `#8A8499` | `#6B6359` |
| Neon accents | Magenta `#FF2E88`, cyan `#2DE2E6`, VHS orange `#FF8A00`, sunset yellow `#FFD319` | One accent per programme, printed red `#B3261E` by default |
| Surfaces | Black VHS-plastic panels with a subtle sheen, glowing neon edges | Thin rules, white space, no glow |

**Type (all free on Google Fonts)**

- Logo and neon signs: **Monoton** (outlined neon-tube letters), with a CSS chrome gradient for the main logo.
- Headings and shelf signs: **Bungee** or **Big Shoulders Display**.
- On-screen text, labels, buttons, timestamps: **VT323** (VCR on-screen display: `PLAY ▶`, `REC ●`, `TRACKING`).
- Body text: **IBM Plex Sans Condensed**.
- Booklet skin: **Fraunces** headlines and **Newsreader** body.

**Signature details**

- Scanlines over the whole app and a slight CRT curve on "screen" elements.
- VHS tracking glitch on page changes: a 300 ms RGB split and a band of static.
- Neon flicker on the store sign, then steady glow.
- Rental stickers for status: "NEW RELEASE", "STAFF PICK", "ON PLEX", "OVERDUE" (scheduled but not watched), edition numbers as price tags (`No. 001`).
- Posters framed as worn clamshell VHS boxes; series as box sets with a season count on the spine.
- Footer: "Be kind, rewind."
- Effects never on body text, and all off under `prefers-reduced-motion` or the Settings toggle.

**The two signature animations**

1. **Walk into the store (app opens).** A 2.5D scene: the store front at night with the neon sign flickering on, the door opens, the camera glides past the counter and pushes in on the shelves, which become the live Shelves page. About 3 seconds, skippable with any click, and a shorter version after the first open of the day. Built with layered illustrations (front, door, counter, shelves) moved by GSAP, not 3D, so it stays fast.
2. **To the festival wall (festival page).** From the shelves, the camera pans to the store's side wall, where this month's festival poster is pinned up with the programme listed under it like a flyer. Each title on the flyer has a tick box drawn like a pen mark; tick it when watched (or it ticks itself when Plex reports the watch). "Open the programme" unfolds the booklet.

**Pages**

1. **Store Front (home).** Neon sign, a CRT TV showing tonight's pick, the Staff Recommends wall, "Continue watching" (series in progress), this month's festival poster in the window, today's 31 Days stamp.
2. **The Shelves.** VHS spines on shelves under hanging section signs (HORROR, ROM-COM, FANTASY, ANIME, SERIES…), with edition price-tag stickers. Click a spine and the box slides out and spins to its back. Toggle to a grid.
3. **The Box (title page).** See Title pages above. Liner notes open in the Booklet skin.
4. **Festival Wall + Programme.** The wall animation, tick-off flyer, and the booklet with notes, schedule and jury awards.
5. **The Back Wall (archive).** Every past festival poster, slightly crooked, held up with tape.
6. **The Rental Card (31 Days of \_\_\_).** A membership-style rental card with 31 boxes, one due-date stamp per day, streak counter, shareable poster at the end. Any theme.
7. **Marathon card (series).** Same rental card, but the boxes are episodes grouped by day.
8. **Curriculum ("The Course Shelf").** A shelf per chapter (e.g. Part I, II, III), a progress bar per shelf and a completion seal.
9. **The Director's Shelf.** One shelf in viewing order, themes on a handwritten staff card, Top 10 chalkboard.
10. **Family tree.** Dark grid, titles as VHS boxes, neon links (cyan = inspired by, magenta = influenced).
11. **Wishlist.** A "Coming Soon" board with the titles you want on Plex.
12. **The Returns Slot (search).** VT323 search box; `TRACKING…` with static while it loads.
13. **Membership Card (settings).** Plex connection, Stremio add-on link, effects toggle.

**Mobile:** one column. Shelves become a vertical stack of spines, the TV fills the width, rental cards become a 7-column calendar, and the intro animation is shortened.

## Data model

Films and series share one `titles` table with a `kind` field, and episodes hang off it, so programmes, recommendations and watch history work the same for both. Every title stores `tmdb_id` and `imdb_id`, which Plex, Stremio and OMDb all match on.

| Table | Key fields | Purpose |
| --- | --- | --- |
| `titles` | id, kind (movie / series), tmdb\_id, imdb\_id, title, year, runtime, seasons\_count, genres, keywords, director\_or\_creator, country, language, poster\_url, backdrop\_url, plex\_rating\_key, on\_plex, ratings (IMDb, RT, Metacritic), metadata\_updated\_at | One row per film or series, cached from TMDB and OMDb |
| `episodes` | id, title\_id, season, episode, name, runtime, plex\_rating\_key | Episode list for series |
| `watches` | id, title\_id, episode\_id (null for films), watched\_at, source (plex / manual), rating, note | Every viewing, unique on (title, episode, date, source) |
| `title_notes` | title\_id, fact\_cards (JSON), liner\_notes, sources (URLs), status (draft / checked) | Fact cards and essays per title |
| `programmes` | id, type, title, slug, theme, essay, start\_date, end\_date, accent\_color, poster\_url, status (draft / live / archived), spine\_number, source\_note | Editions, festivals, 31 Days, marathons, curricula, retrospectives… |
| `programme_items` | programme\_id, title\_id, episode\_id, position, chapter, slot\_date, programme\_note, done | Ordered items, with chapters (curricula) and daily slots (31 Days, marathons) |
| `awards` | programme\_id, category, title\_id, note | Festival jury awards |
| `title_links` | from\_title\_id, to\_title\_id, kind (inspired / influenced / pairs\_with), note, verified | Family tree, edition pairings |
| `recommendations` | title\_id, lane (popular / deep\_cut), reason, score, created\_at, feedback (up / down / dismissed) | This week's suggestions |
| `wishlist` | title\_id, added\_at, note | Titles you want on Plex; cleared by the Plex sync |
| `pending_checks` | title\_id, episode\_id, opened\_at | Titles opened in Stremio, for the "Did you finish it?" prompt |

**Rules:** "Watched" is always computed from `watches`. A series counts as finished when every episode has a watch. Single user: Supabase auth with only your account, row-level security on.

## Integrations

Five services, all free for personal use: TMDB for metadata and recommendations, OMDb for IMDb/RT/Metacritic ratings, Wikipedia for facts, Plex as library and watch history, and your own Stremio add-on.

### TMDB (metadata, recommendations, where to watch)

- Free API key for personal use; credit TMDB in the footer.
- Films and series: search, details, credits, keywords, images, `external_ids` (for the IMDb ID), reviews, recommendations, similar titles, Discover, and director/creator filmographies.
- Where to watch: the watch-providers endpoint for region PT. That data comes from JustWatch, which must be credited where it's shown.
- Cache in `titles`; refresh when a page is opened and the data is older than 30 days.

### OMDb (ratings)

- Free key from omdbapi.com, 1,000 requests a day, which is plenty because ratings are cached per title.
- Look up by IMDb ID to get the IMDb rating, Rotten Tomatoes (films only) and Metacritic.

### Wikipedia (facts for fact cards and liner notes)

- Free, no key. Find a title's article through Wikidata using its IMDb ID, then fetch the article text.
- Claude summarises only what's in that text into fact cards, and every card links back to the article.

### Plex (library, playback, watch history)

Your Plex server's local API at `http://<server>:32400`, authenticated with your `X-Plex-Token`. Running the Cinematheque on the NAS next to Plex keeps this on your home network.

| Feature | How | Version |
| --- | --- | --- |
| Library | Read movie and TV sections with `includeGuids=1`; match `imdb://` / `tmdb://` GUIDs to `titles`; store `plex_rating_key` | v1 |
| Episodes | For each show, read all episodes (`/library/metadata/<key>/allLeaves`) into `episodes` | v1 |
| Watch history | Hourly: a `lastViewedAt` newer than the one stored on a film or episode = a new row in `watches` (source plex). Works without Plex Pass | v1 |
| Play on Plex | Deep link `https://app.plex.tv/desktop#!/server/<machineIdentifier>/details?key=/library/metadata/<ratingKey>` | v1 |
| Wishlist check | Any wishlist title found in the sync gets ON PLEX and leaves the wishlist | v1 |
| Instant logging | Webhooks on `media.scrobble` (needs Plex Pass) tick festival flyers the moment a title ends | v2 |
| Programme → Plex collection | A Plex collection per programme, in order, with your poster | v2 |

### Stremio (your Cinematheque add-on)

- Built with the official `stremio-addon-sdk` and served from the same app at `/api/stremio`. Its `manifest.json` lists one catalogue per live programme ("October Festival", "31 Days of Rom-Coms", "Staff Picks"), for both films and series, using IMDb IDs in programme order.
- Stremio needs HTTPS for an add-on hosted outside your network; on the NAS, put it behind a free HTTPS tunnel (e.g. Cloudflare Tunnel) or keep Stremio on the same network.
- Install once by opening the manifest URL in Stremio. Programme changes appear there automatically.
- **"Open in Stremio"** buttons use `stremio:///detail/movie/<imdb_id>` (or `/series/`). Pressing one adds a `pending_checks` row; next time you open the Cinematheque it asks "Did you finish it?" (Yes / Not yet / Dropped it), and Yes logs the watch with your rating.

### Not used

- **Letterboxd:** its API is by request only, and Letterboxd says it isn't granting access for private or personal projects, so automatic syncing of watches and stars isn't possible. Ratings and reviews live in the Cinematheque instead.
- **Trakt:** not needed now that Plex and the "Did you finish it?" prompt cover your history.

Sources: [Letterboxd API access](https://letterboxd.com/api-beta/)

## AI features

Claude writes and suggests, and the app checks: every output is grounded in data the app fetched, saved as a draft, and only shown as checked when you say so.

| Feature | Input sent to Claude | Output | Version |
| --- | --- | --- | --- |
| Fact cards | Title's Wikipedia text + TMDB details | 4–6 cards of 1–2 sentences, each with its source | v1 |
| Liner notes | Same sources + your rating and notes | 300–500 word mini essay | v1 |
| Edition essay | Same sources + your notes | 400–600 word essay for an inducted title | v1 |
| Deep cuts | Your taste profile (top keywords, genres, decades, favourites) | 10 suggestions a week with a reason each; the app keeps only those it finds on TMDB | v1 |
| Festival and 31 Days themes | Your library, watch history, wishlist | 5 theme ideas with a pitch and matching titles | v1 |
| Programme notes | Title details + the theme | 80–120 words per title on why it fits | v1 |
| Curriculum import | A list you paste (e.g. titles from *In Search of Darkness*) | Cleaned title + year list grouped into chapters, matched to TMDB for you to confirm | v2 |
| Director themes | Filmography from TMDB | 4–6 themes to watch for, in viewing order | v2 |
| Family tree candidates | One title | Suggested ancestors and descendants with reasons, saved as unverified | v2 |
| Time capsule | A year | Notable films, series, albums, events and fashion | v2 |

**Rules for every prompt**

- Server routes only; the API key lives in an environment variable.
- JSON output, saved into the right fields.
- "Use only the facts provided. If something isn't in the sources, leave it out." Every fact card keeps its source URL.
- Curriculum lists come from your source (the documentary, its credits or a list you trust), never from Claude's memory: Claude only cleans and structures what you paste.
- Use a smaller, cheaper Claude model for fact cards, notes and themes, and a larger one for essays and deep cuts.

## Claude Code plugins and design tools

Three add-ons cover most of what keeps a vibe-coded app from looking generic: one that shapes Claude's design choices, one that lets Claude see the page it built, and one that keeps its library knowledge current.

| Add-on | What it does for this app | Install (in Claude Code) |
| --- | --- | --- |
| Frontend Design (Anthropic's official plugin) | Pushes Claude toward bold, specific design choices instead of default-looking UI | `/plugin install frontend-design@claude-plugins-official` |
| Playwright MCP | Claude opens the app in a browser, takes screenshots and fixes what looks off; essential for checking animations, glow and mobile layouts | Run in your terminal: `claude mcp add playwright npx @playwright/mcp@latest` |
| Context7 MCP | Gives Claude up-to-date docs for Next.js, Supabase, GSAP and Tailwind, so it doesn't write outdated code | Run in your terminal: `claude mcp add context7 -- npx -y @upstash/context7-mcp` |

**Habits that matter as much as plugins**

- **Give it real references.** Put a `design/references/` folder in the repo with screenshots: 80s VHS box fronts, video store shelves, neon signs, title cards from *In Search of Darkness*. Tell Claude to study them before each design session.
- **Real assets beat CSS tricks.** Add actual textures (VHS box wear, paper grain, film grain, carpet) as images, and a few illustrated layers for the store intro. You can make these in an image generator or find them on free texture sites; the code just places them.
- **Ban the AI defaults in BRIEF.md:** no purple-to-blue gradients, no soft rounded cards with drop shadows, no Inter or system fonts, no emoji as icons, no centred hero with three feature cards.
- **Use proper animation libraries:** GSAP for the store intro and festival wall camera moves, Framer Motion for small interactions (box slide-out, sticker peel).
- **Close the loop:** after each design prompt, ask "Take Playwright screenshots at desktop and phone width, compare them with the references, and list what still looks generic before fixing it."

Sources: [Frontend Design plugin setup](https://designrevision.com/blog/claude-code-frontend-design-plugin)

## Build plan

The build runs in nine phases, each ending with something you can use. Commit to GitHub after each one. Paste the prompts into Claude Code with BRIEF.md (next section) in the repo.

### Phase 0: Setup

- [ ] Accounts and keys: GitHub, Supabase, TMDB API key, OMDb API key, Anthropic API key (and Vercel if you don't host on the NAS).
- [ ] Your Plex token and server URL (Plex's support pages explain how to find your `X-Plex-Token`).
- [ ] Install the three Claude Code add-ons from the section above.
- [ ] Make an empty repo with `BRIEF.md` and a `design/references/` folder of screenshots.

```
Read BRIEF.md. Scaffold a Next.js App Router project with TypeScript, Tailwind, the Supabase client, GSAP and Framer Motion. Create .env.local.example with every key the brief lists. Don't build pages yet. List the files you created.
```

### Phase 1: The look, on fake data

```
Read BRIEF.md (Design) and look at every image in design/references. Create the Video Store and Programme skins as CSS variables and Tailwind tokens, load the fonts, and build the scanlines, neon flicker and page-change tracking glitch (all off under prefers-reduced-motion). Build the Store Front, Shelves and The Box pages with 20 hardcoded titles (films and series) in a JSON file. Then take Playwright screenshots at desktop and phone width and fix anything that looks generic.
```

Iterate until you love it ("more glow on the sign", "chunkier spines", "stickers peeled at one corner").

### Phase 2: Database, TMDB and OMDb

```
Create Supabase migrations for every table in BRIEF.md with row-level security for a single user, and add email login. Add a TMDB search (films and series) that saves a title with its imdb_id, keywords and credits, then fetches OMDb ratings by IMDb ID. Replace the JSON with database reads.
```

### Phase 3: Plex

```
Add a Plex connection in Settings (server URL + token, server side only). Write an hourly sync that reads my movie and TV libraries with includeGuids=1, creates or matches titles by imdb/tmdb GUID, loads every episode for each show, stores plex_rating_key and on_plex, and writes a new watch (source plex) whenever a film's or episode's lastViewedAt is newer than the stored one. Add ON PLEX stickers, Play on Plex deep links, "Continue watching" on the Store Front, and clear wishlist items that appear in the sync.
```

### Phase 4: Title pages

```
Complete The Box page as in BRIEF.md: ratings, synopsis, TMDB reviews, where to watch in PT (credit JustWatch), seasons and episodes for series. Then add fact cards and liner notes: find the Wikipedia article via Wikidata using the IMDb ID, send its text to the Claude API with the rule "use only these facts", save the result to title_notes as a draft with source links, and show it in the Programme skin.
```

### Phase 5: Recommendations

```
Build the recommendations engine from BRIEF.md: a nightly taste profile from my watches and ratings, candidates from TMDB recommendations, similar and Discover, split into Popular Picks and Deep Cuts, plus 10 weekly deep cuts from the Claude API that are kept only if found on TMDB. Show the Staff Recommends wall, More like this on title pages, the Wishlist page, and thumbs up/down that update the profile.
```

### Phase 6: Programmes, part 1

```
Build programmes: Editions (induct a title, next spine number, essay draft), Festivals (any theme, programme booklet, schedule, tick-off, jury awards after the end date) and 31 Days of ___ (any theme, 31 slots, rental card with daily stamps and streak). Items tick themselves when a matching watch arrives from Plex.
```

### Phase 7: The two animations

```
Build the walk-into-the-store intro with GSAP using the layered illustrations in public/store/ (exterior, door, counter, shelves): sign flickers on, door opens, camera pushes in to the shelves, then hands over to the live Shelves page. Skippable, shorter after the first open of the day, off under reduced motion. Then build the camera pan from the shelves to the festival wall, with the poster and a tick-off flyer of the programme.
```

### Phase 8: Stremio add-on

```
Add a Stremio add-on with stremio-addon-sdk at /api/stremio exposing each live programme as a catalogue (movies and series, IMDb IDs, programme order). Add Open in Stremio buttons (stremio:///detail/movie|series/<imdb_id>) that create a pending_checks row, and a "Did you finish it?" modal on next app open with Yes (log watch + rating), Not yet and Dropped it.
```

### Phase 9: v2 programmes (one prompt each)

1. Series marathon: pick a series, choose episodes per day, generate the marathon card, nudge on the Store Front when behind.
2. Curriculum: paste a list, Claude cleans it into chapters, confirm TMDB matches, Course Shelf with progress per chapter.
3. Director retrospective, family tree (React Flow), year in a decade, final girls archive.
4. Festival poster generator, Plex collection sync, Plex webhooks if you have Plex Pass.

## BRIEF.md

Copy this into the root of the repo and tell Claude Code to read it at the start of every session. Update it whenever you make a decision.

```markdown
# The Cinematheque

A personal 80s video store for everything on my Plex server (films and series): watch history, recommendations (popular + deep cuts), title pages with facts and essays, and programmes (editions, festivals, 31 Days of ___, series marathons, curricula, retrospectives). Single user (me).

## Stack
Next.js App Router, TypeScript, Tailwind, Supabase (Postgres, auth, storage, cron), GSAP, Framer Motion. Docker on my NAS next to Plex (or Vercel).

## Data model
- titles: id, kind (movie|series), tmdb_id, imdb_id, title, year, runtime, seasons_count, genres, keywords, director_or_creator, country, language, poster_url, backdrop_url, plex_rating_key, on_plex, ratings (imdb, rt, metacritic), metadata_updated_at
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
- TMDB: films + series search, details, credits, keywords, external_ids, reviews, recommendations, similar, discover, watch providers (region PT, credit JustWatch). Credit TMDB in the footer.
- OMDb: ratings by IMDb ID (IMDb, Rotten Tomatoes, Metacritic). Cache per title.
- Wikipedia: find the article via Wikidata by IMDb ID; text is the only source for fact cards and liner notes.
- Plex (library + history): local API with X-Plex-Token. Hourly sync of movie and TV sections with includeGuids=1 and all episodes; new lastViewedAt = new watch. Play deep links. Wishlist cleared when a title appears.
- Stremio: add-on at /api/stremio (stremio-addon-sdk), one catalogue per live programme, movies + series, IMDb IDs. Open in Stremio → pending_checks → "Did you finish it?" modal.
- No Letterboxd, no Trakt.
- Claude API: server routes only, JSON output, only facts from provided sources, drafts until I mark them checked.

## Recommendations
Nightly taste profile (genres, keywords, directors, decades, countries, finished vs dropped series; recent weighs more). Candidates from TMDB recommendations/similar/discover. Lanes: popular (many votes, high average) and deep_cut (few votes, strong average, older, non-English) + 10 weekly Claude deep cuts kept only if found on TMDB. Hide watched, on-Plex (shown separately) and dismissed.

## Design
80s video store after closing time (In Search of Darkness vibe): neon signs, VHS boxes on shelves, CRT screens, rental stickers.
Video Store skin (everywhere): bg #0B0A12, text #EDE6D6, muted #8A8499, magenta #FF2E88, cyan #2DE2E6, VHS orange #FF8A00, yellow #FFD319.
Programme skin (festival booklet, essays, liner notes): bg #F4EFE6, text #1A1714, muted #6B6359, accent #B3261E.
Fonts: Monoton (logo/neon), Bungee or Big Shoulders Display (headings, shelf signs), VT323 (OSD labels, buttons), IBM Plex Sans Condensed (body); Fraunces + Newsreader in the Programme skin.
Effects: scanlines, CRT curve, page-change tracking glitch, neon flicker, rental stickers (NEW RELEASE, STAFF PICK, ON PLEX, OVERDUE, No. 001). Off under prefers-reduced-motion and via a Settings toggle. Never on body text.
Animations: walk-into-the-store intro (GSAP, layered illustrations, skippable); camera pan to the festival wall with a tick-off flyer.
Pages: Store Front, Shelves, The Box, Festival Wall + Programme, Back Wall, Rental Card, Marathon card, Course Shelf, Director's Shelf, Family tree, Wishlist, Returns Slot (search), Membership Card (settings). Mobile first.
Banned: purple-blue gradients, soft rounded cards with shadows, Inter/system fonts, emoji icons, centred hero + three feature cards.
References: design/references/ — study them before any design work.

## Rules for the AI
- Read this file first. List the files you'll change before coding.
- One feature per session. Don't refactor unrelated code.
- Secrets only in .env.local, used server side only.
- After any UI change, check it with Playwright screenshots at desktop and phone width.
```

## Watch-outs and open questions

- **Plex outside your home:** the app reaches Plex easily when both run on the NAS. Hosted elsewhere, it needs Plex remote access.
- **Watch history granularity:** the hourly sync sees the latest viewing of each film or episode, so watching the same thing twice between syncs counts once.
- **Stremio logging depends on you:** the "Did you finish it?" prompt only knows what you opened from the Cinematheque, not what you browse to directly in Stremio.
- **Stremio streams:** your add-on only lists titles; what plays depends on the stream add-ons you already have installed.
- **Facts and essays:** grounding in Wikipedia keeps them accurate, but some niche titles have no article; then the app shows TMDB info only instead of guessing.
- **Curriculum lists:** they must come from a source you trust. Claude tidies the list but shouldn't fill gaps from memory.
- **Intro animation:** it's the most fun part and the easiest to overdo. Keep it under 3 seconds and always skippable, or it gets old fast.
- **Costs:** TMDB, OMDb (free tier), Wikipedia and the Stremio SDK are free; Supabase's free tier covers a single user; the Claude API is pay-per-use, likely a few euros a month, mostly from fact cards and liner notes (generated once per title).

**Open questions**

- [ ] Host on the NAS or on Vercel?
- [ ] Do you have Plex Pass (for instant tick-offs via webhooks)?
- [ ] Section signs on the Shelves: by genre only, or also by mood or decade?
- [ ] Edition spine numbers: in induction order, or hand-assigned?
