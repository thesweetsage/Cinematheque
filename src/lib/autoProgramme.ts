import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { saveOffShelf, slugify } from "./importTitle";
import { ACCENTS } from "./programmes";
import { getSetting } from "./settings";
import { db, selectAll } from "./supabase";
import { discover, genreIds, lookupTitle, type Candidate } from "./tmdb";

/*
 * Programmes that build themselves (films only; series get marathons). Choose a genre and/or a decade, type a theme,
 * or ask for a surprise, and the programme is filled from all of TMDB, with what's already on your Plex mixed in and
 * unwatched titles first. Titles you don't have are saved to the store off the shelves, so they can be wishlisted.
 *
 * With a Claude key, Claude curates: for a genre or decade it picks from the TMDB / shelf list it's given (by id, checked);
 * for a typed theme or a surprise it suggests titles, and each one is looked up on TMDB and dropped if it isn't found.
 * Claude also names it, orders it and writes the booklet and a note per title. Without a key, the best-rated matches are used.
 */

export const CURATOR_MODEL = "claude-opus-5-5";
export type AutoKind = "festival" | "days31";
export type Ask = { kind: AutoKind; genre?: string | null; decade?: number | null; theme?: string | null };
export type Curated = { title: string; theme: string; essay: string | null; items: { titleId: string; note: string | null }[] };

/** The genre buttons, with how each maps onto TMDB. */
export const GENRES: { key: string; label: string; name: string; all: number[]; language?: string }[] = [
  { key: "horror", label: "Horror", name: "Horror", all: [27] },
  { key: "scifi", label: "Sci-Fi", name: "Sci-Fi", all: [878] },
  { key: "fantasy", label: "Fantasy", name: "Fantasy", all: [14] },
  { key: "thriller", label: "Thriller", name: "Thrillers", all: [53] },
  { key: "crime", label: "Crime", name: "Crime", all: [80] },
  { key: "mystery", label: "Mystery", name: "Mysteries", all: [9648] },
  { key: "action", label: "Action", name: "Action", all: [28] },
  { key: "adventure", label: "Adventure", name: "Adventure", all: [12] },
  { key: "comedy", label: "Comedy", name: "Comedy", all: [35] },
  { key: "romcom", label: "Rom-Com", name: "Rom-Coms", all: [10749, 35] },
  { key: "romance", label: "Romance", name: "Romance", all: [10749] },
  { key: "drama", label: "Drama", name: "Drama", all: [18] },
  { key: "war", label: "War", name: "War Films", all: [10752] },
  { key: "western", label: "Western", name: "Westerns", all: [37] },
  { key: "animation", label: "Animation", name: "Animation", all: [16] },
  { key: "anime", label: "Anime", name: "Anime", all: [16], language: "ja" },
  { key: "family", label: "Family", name: "Family Films", all: [10751] },
  { key: "music", label: "Music", name: "Musicals", all: [10402] },
  { key: "documentary", label: "Documentary", name: "Documentaries", all: [99] },
];
export const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
export const decadeLabel = (d: number) => `${String(d).slice(2)}s`;

const WANT: Record<AutoKind, number> = { festival: 8, days31: 31 };

type Lib = { id: string; tmdb_id: number | null; title: string; year: number | null; genres: string[]; on_plex: boolean; watched: boolean };
type Pick = Candidate & { onPlex: boolean; watched: boolean; libId?: string; note?: string | null };

/** Your films: what's on the shelves, and what's been watched. */
async function library() {
  const client = db();
  if (!client) throw new Error("The database isn't connected yet.");
  const [rows, watches] = await Promise.all([
    selectAll<Omit<Lib, "watched"> & { in_library: boolean }>((a, b) => client.from("titles").select("id, tmdb_id, title, year, genres, on_plex, in_library").eq("kind", "movie").range(a, b)),
    selectAll<{ title_id: string }>((a, b) => client.from("watches").select("title_id").range(a, b)),
  ]);
  const seen = new Set(watches.map((w) => w.title_id));
  return rows.map((r) => ({ ...r, watched: seen.has(r.id), onShelf: r.on_plex || r.in_library }));
}

/** Builds the programme. Throws with a readable message when it can't. */
export async function curate(ask: Ask): Promise<Curated> {
  if (!process.env.TMDB_API_KEY) throw new Error("Add TMDB_API_KEY to .env.local: programmes are built from TMDB.");
  const want = WANT[ask.kind];
  const lib = await library();
  const byTmdb = new Map(lib.filter((r) => r.tmdb_id).map((r) => [r.tmdb_id!, r]));
  const genre = ask.genre ? GENRES.find((g) => g.key === ask.genre) : undefined;
  const theme = ask.theme?.trim() || null;
  const claude = !!process.env.ANTHROPIC_API_KEY;

  let picks: Pick[] = [];
  let named: { name: string; theme: string; essay: string | null } | null = null;

  if (theme || (!genre && !ask.decade)) {
    // A typed theme, or a surprise: needs Claude to suggest titles (checked on TMDB). Without it, a surprise is a genre.
    if (claude) {
      const r = await claudeSuggest(ask.kind, theme, want, lib);
      picks = r.picks.map((c) => mark(c, byTmdb));
      named = r.named;
    } else if (theme) {
      throw new Error("Typed themes need a Claude key (ANTHROPIC_API_KEY). Pick a genre or a decade instead.");
    } else {
      return curate({ ...ask, genre: (await favouriteGenre()) ?? "horror" });
    }
  } else {
    const pool = await gather(genre, ask.decade ?? null, byTmdb);
    if (!pool.length) throw new Error("TMDB has nothing for that combination. Try a wider one.");
    if (claude) {
      try {
        const r = await claudePick(ask.kind, describe(genre, ask.decade ?? null), pool, want);
        picks = r.picks; named = r.named;
      } catch (e) { console.error("[programmes] Claude couldn't curate, using the best-rated matches:", (e as Error).message); }
    }
    if (!picks.length) picks = rank(pool).slice(0, want);
  }
  if (!picks.length) throw new Error("Couldn't find films for that. Try another theme.");

  // Save the titles the store doesn't have yet (off the shelves), four at a time.
  const items: Curated["items"] = new Array(picks.length);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < picks.length) {
      const i = next++, p = picks[i];
      try {
        const id = p.libId ?? (await saveOffShelf("movie", p.tmdbId)).id;
        items[i] = { titleId: id, note: p.note ?? null };
      } catch (e) { console.error(`[programmes] couldn't add ${p.title}:`, (e as Error).message); }
    }
  }));
  const kept = items.filter(Boolean);
  if (!kept.length) throw new Error("Couldn't save any of the films. Check the TMDB key.");

  const label = describe(genre, ask.decade ?? null);
  const name = cleanName(named?.name ?? (theme || label));
  return {
    title: ask.kind === "days31" ? `31 Days of ${name}` : named?.name ? name : `${name} Festival`,
    theme: named?.theme ?? (ask.kind === "days31" ? `One ${label.toLowerCase()} film a night for 31 nights.` : `${kept.length} ${label.toLowerCase()} films, the ones on your Plex mixed in.`),
    essay: named?.essay ?? null,
    items: kept,
  };
}

/** "31 Days of Thirty-One Nights of the 80s" never again: the name is only the theme. */
const cleanName = (s: string) => s.trim().replace(/^(31|thirty[- ]one)\s+(days|nights)\s+(of\s+)?/i, "").replace(/\s+festival$/i, "").slice(0, 60) || "Cinema";

/** "80s Horror", "Westerns", "the '70s": the programme's name when Claude isn't naming it. */
const describe = (g: (typeof GENRES)[number] | undefined, decade: number | null) =>
  g ? [decade ? decadeLabel(decade) : null, g.name].filter(Boolean).join(" ") : decade ? `the '${decadeLabel(decade)}` : "Cinema";

const mark = (c: Candidate, byTmdb: Map<number, Lib & { onShelf?: boolean }>): Pick => {
  const l = byTmdb.get(c.tmdbId);
  return { ...c, onPlex: !!l?.on_plex, watched: !!l?.watched, libId: l?.id };
};

/** TMDB's well-known and well-rated matches plus a few lesser-known ones, merged with what's on your shelves. */
async function gather(g: (typeof GENRES)[number] | undefined, decade: number | null, byTmdb: Map<number, Lib & { onShelf?: boolean }>) {
  const base = { allGenres: g?.all, language: g?.language, after: decade ?? undefined, before: decade ? decade + 9 : undefined };
  const lists = await Promise.all([
    ...[1, 2, 3].map((page) => discover("movie", { ...base, minVotes: 150, sort: "vote_count.desc", page }).catch(() => [])),
    ...[1, 2].map((page) => discover("movie", { ...base, minVotes: 300, page }).catch(() => [])),
    discover("movie", { ...base, minVotes: 40, maxVotes: 800, page: 1 }).catch(() => []),
  ]);
  const seen = new Map<number, Pick>();
  for (const c of lists.flat()) if (!seen.has(c.tmdbId) && c.year) seen.set(c.tmdbId, mark(c, byTmdb));
  return [...seen.values()];
}

/** Without Claude: unwatched first, then what's on your Plex, then the best rated; a little variety by decade. */
function rank(pool: Pick[]) {
  const score = (p: Pick) => (p.watched ? -4 : 0) + (p.onPlex ? 1.5 : 0) + p.avg + Math.log10(Math.max(10, p.votes)) * 0.5;
  const sorted = [...pool].sort((a, b) => score(b) - score(a));
  const perDecade = new Map<number, number>(), out: Pick[] = [];
  for (const p of sorted) { const d = Math.floor((p.year ?? 0) / 10); if ((perDecade.get(d) ?? 0) < 6) { out.push(p); perDecade.set(d, (perDecade.get(d) ?? 0) + 1); } }
  return [...out, ...sorted.filter((p) => !out.includes(p))];
}

async function favouriteGenre() {
  const profile = await getSetting<{ genres: [string, number][] }>("taste_profile").catch(() => null);
  const fav = profile?.genres.find(([g]) => GENRES.some((x) => x.label.toLowerCase() === g.toLowerCase() || (g === "Science Fiction" && x.key === "scifi")));
  return fav ? GENRES.find((x) => x.label.toLowerCase() === fav[0].toLowerCase())?.key ?? (fav[0] === "Science Fiction" ? "scifi" : null) : null;
}

/* ---------- Claude ---------- */

const NAMING = `Name the programme with its theme only, 1 to 4 words, like "Slashers", "Folk Horror", "Neon Noir" or "the '80s". Never put a number of days or nights in the name: the app adds "31 Days of" itself.`;
const BOOKLET = "booklet: programme notes, 120 to 220 words in 2 or 3 paragraphs separated by blank lines, about the theme and why these films, with no endings revealed.";

const PICK_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name", "theme", "booklet", "picks"],
  properties: {
    name: { type: "string" }, theme: { type: "string", description: "One or two sentences" }, booklet: { type: "string" },
    picks: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "note"], properties: { id: { type: "string" }, note: { type: "string", description: "Under 90 characters" } } } },
  },
};

async function ask<T>(system: string, user: string, schema: Record<string, unknown>): Promise<T> {
  const response = await new Anthropic().beta.messages.create({
    model: CURATOR_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No answer from Claude.");
  return JSON.parse(text.text) as T;
}

/** Genre / decade: Claude chooses from the list it's given, by id; anything not on the list is ignored. */
async function claudePick(kind: AutoKind, label: string, pool: Pick[], want: number) {
  const gmap = new Map([...(await genreIds("movie"))].map(([n, id]) => [id, n]));
  const list = rank(pool).slice(0, 120).map((p) => [
    `id=${p.tmdbId}`, `${p.title} (${p.year})`, p.genreIds.map((g) => gmap.get(g)).filter(Boolean).join("/"),
    p.onPlex ? "ON THE MEMBER'S PLEX" : "not owned", p.watched ? "watched" : "unwatched",
    `TMDB ${p.avg.toFixed(1)} from ${p.votes} votes`, p.overview.slice(0, 150),
  ].join(" | ")).join("\n");
  const out = await ask<{ name: string; theme: string; booklet: string; picks: { id: string; note: string }[] }>(
    `You programme a small personal video store's ${kind === "festival" ? "film festivals" : "31-day film challenges"}. Choose only from the list you're given, by copying each film's id exactly. Every film must truly fit the brief. Mix famous titles with lesser-known ones, prefer unwatched films, include several marked ON THE MEMBER'S PLEX when they fit, and order them so the programme builds to a strong last night. Notes and the booklet use only what the list says about each film; don't add facts from memory. ${NAMING}`,
    `<films>\n${list}\n</films>\n\n${kind === "festival" ? `A festival of ${want} films` : `A 31 Days challenge: ${want} films, one a night`}: ${label}. Write: name, theme, ${BOOKLET} Then the picks with a one-line note each.`,
    PICK_SCHEMA,
  );
  const byId = new Map(pool.map((p) => [String(p.tmdbId), p])), used = new Set<string>();
  const picks = out.picks.filter((x) => byId.has(x.id) && !used.has(x.id) && used.add(x.id)).slice(0, want).map((x) => ({ ...byId.get(x.id)!, note: x.note?.trim().slice(0, 140) || null }));
  if (picks.length < Math.min(want, pool.length) / 2) throw new Error("Claude's picks weren't on the list.");
  return { picks, named: { name: out.name, theme: out.theme.trim(), essay: out.booklet.trim() || null } };
}

const SUGGEST_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name", "theme", "booklet", "films"],
  properties: {
    name: { type: "string" }, theme: { type: "string" }, booklet: { type: "string" },
    films: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "year", "note"], properties: { title: { type: "string", description: "As listed on TMDB in English" }, year: { type: "integer" }, note: { type: "string", description: "Under 90 characters" } } } },
  },
};

/** A typed theme or a surprise: Claude suggests films; each is looked up on TMDB and dropped if it isn't found. */
async function claudeSuggest(kind: AutoKind, theme: string | null, want: number, lib: (Lib & { onShelf: boolean })[]) {
  const profile = await getSetting<{ genres: [string, number][]; keywords: [string, number][]; seeds: { title: string }[] }>("taste_profile").catch(() => null);
  const owned = lib.filter((l) => l.onShelf).slice(0, 300).map((l) => `${l.title}${l.year ? ` (${l.year})` : ""}${l.watched ? " [watched]" : ""}`).join("\n");
  const taste = profile ? `Their top genres: ${profile.genres.slice(0, 6).map(([g]) => g).join(", ")}. Recurring keywords: ${profile.keywords.slice(0, 8).map(([k]) => k).join(", ")}. Recent favourites: ${profile.seeds.slice(0, 6).map((s) => s.title).join(", ")}.` : "";
  const out = await ask<{ name: string; theme: string; booklet: string; films: { title: string; year: number; note: string }[] }>(
    `You programme a small personal video store's ${kind === "festival" ? "film festivals" : "31-day film challenges"}, for one member. Suggest only real feature films you're sure exist, with the correct release year: they'll be checked against TMDB. Every film must truly fit the theme. Mix famous titles with lesser-known ones and several decades, prefer films the member hasn't watched, and include some from their own shelves when they fit. ${NAMING}`,
    `${theme ? `Theme: "${theme}"` : `No theme given: choose one that suits this member. ${taste}`}\n\n<their_shelves>\n${owned}\n</their_shelves>\n\n${kind === "festival" ? `A festival of ${want} films` : `A 31 Days challenge: ${want} films, one a night`}. Suggest ${want + 6} films in viewing order (the extra ones are spares in case some can't be found). Write: name, theme, ${BOOKLET} Then the films with a one-line note each.`,
    SUGGEST_SCHEMA,
  );
  const found: Candidate[] = [], notes = new Map<number, string>();
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < out.films.length) {
      const f = out.films[i++];
      const c = await lookupTitle("movie", f.title, f.year).catch(() => null);
      if (c && !found.some((x) => x.tmdbId === c.tmdbId)) { found.push({ ...c, overview: String(out.films.indexOf(f)).padStart(3, "0") }); notes.set(c.tmdbId, f.note); }
    }
  }));
  // Back in Claude's order (the lookups ran in parallel).
  found.sort((a, b) => a.overview.localeCompare(b.overview));
  const picks = found.slice(0, want).map((c) => ({ ...c, note: notes.get(c.tmdbId)?.trim().slice(0, 140) || null }));
  return { picks, named: { name: out.name, theme: out.theme.trim(), essay: out.booklet.trim() || null } };
}

const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

/**
 * Curates and saves a programme, live from today. A festival runs four weeks with its films spread across them;
 * a 31 Days gets one film a night. Returns its slug.
 */
export async function buildProgramme(ask: Ask): Promise<string> {
  const c = await curate(ask);
  const client = db()!;
  const start = new Date().toLocaleDateString("en-CA");
  const days = ask.kind === "days31" ? 31 : 28;
  const n = c.items.length;
  const dateOf = (i: number) => ask.kind === "days31" ? addDays(start, i) : addDays(start, n > 1 ? Math.round((i * (days - 1)) / (n - 1)) : 0);
  const accent = ask.kind === "days31" ? "#FF4FB8" : ACCENTS[(n + start.charCodeAt(9)) % ACCENTS.length];
  const base = slugify(c.title, Number(start.slice(0, 4)));
  const note = [ask.genre && GENRES.find((g) => g.key === ask.genre)?.label, ask.decade && decadeLabel(ask.decade), ask.theme && `"${ask.theme}"`].filter(Boolean).join(", ");
  for (const slug of [base, `${base}-${start.slice(5, 7)}`, `${base}-${Date.now().toString(36)}`]) {
    const { data, error } = await client.from("programmes").insert({
      type: ask.kind, title: c.title, slug, theme: c.theme || null, essay: c.essay, start_date: start, end_date: addDays(start, days - 1),
      accent_color: accent, status: "live", source_note: `Built from: ${note || "a surprise"}`,
    }).select("id").single();
    if (error?.code === "23505") continue;
    if (error) throw new Error(error.message);
    const pid = (data as { id: string }).id;
    const { error: e2 } = await client.from("programme_items").insert(c.items.map((it, i) => ({
      programme_id: pid, title_id: it.titleId, position: i, slot_date: dateOf(i), programme_note: it.note,
    })));
    if (e2) throw new Error(e2.message);
    return slug;
  }
  throw new Error("Couldn't find a free name for it. Try again.");
}
