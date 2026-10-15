import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { aisleOf } from "./rowToTitle";
import { db, selectAll } from "./supabase";

/*
 * Programmes that build themselves. Pick a festival or a 31 Days and a genre (or type any theme, or "Surprise me"):
 * the titles come from your own shelves (on Plex or in the library), unwatched ones first.
 * With a Claude key, Claude curates: it picks from the shelf list it's given (and only from it), puts them in an order,
 * names the programme and writes the booklet and a one-line note per title. Without one, the genre's best-rated
 * unwatched titles are spread across the dates. Either way it can be edited afterwards.
 */

export const CURATOR_MODEL = "claude-opus-5-5";
export type AutoKind = "festival" | "days31";
export type Curated = { title: string; theme: string; essay: string | null; items: { titleId: string; note: string | null }[] };

type Row = {
  id: string; title: string; year: number | null; kind: "movie" | "series"; genres: string[]; keywords: string[];
  language: string | null; country: string | null; director_or_creator: string | null; overview: string | null;
  rating_imdb: number | null;
};

const WANT: Record<AutoKind, number> = { festival: 8, days31: 31 };

/** The shelves: everything on Plex or put on the shelves, with whether it's been watched. */
async function shelf() {
  const client = db();
  if (!client) throw new Error("The database isn't connected yet.");
  const [rows, watches] = await Promise.all([
    selectAll<Row>((a, b) => client.from("titles")
      .select("id, title, year, kind, genres, keywords, language, country, director_or_creator, overview, rating_imdb")
      .or("on_plex.eq.true,in_library.eq.true").range(a, b)),
    selectAll<{ title_id: string }>((a, b) => client.from("watches").select("title_id").range(a, b)),
  ]);
  return { rows, watched: new Set(watches.map((w) => w.title_id)) };
}

/** The aisles on the shelves, biggest first, for the genre buttons. */
export async function shelfGenres(): Promise<{ g: string; n: number }[]> {
  const { rows } = await shelf();
  const n = new Map<string, number>();
  for (const r of rows) { const g = aisleOf(r.kind, r.genres, r.language); n.set(g, (n.get(g) ?? 0) + 1); }
  return [...n].map(([g, c]) => ({ g, n: c })).sort((a, b) => b.n - a.n);
}

const matches = (r: Row, genre: string) => {
  const g = genre.toUpperCase();
  if (/^\d{2}S$/.test(g) || /^\d{4}S$/.test(g)) { // "80S", "1980S": a decade
    const d = Number(g.length === 3 ? `19${g.slice(0, 2)}` : g.slice(0, 4));
    return !!r.year && r.year >= d && r.year < d + 10;
  }
  return aisleOf(r.kind, r.genres, r.language) === g || r.genres.some((x) => x.toUpperCase() === g);
};

/** Curates a programme. `genre` is an aisle (HORROR) or a decade (80S); `theme` is free text; neither = surprise. */
export async function curate(kind: AutoKind, genre: string | null, theme: string | null): Promise<Curated> {
  const { rows, watched } = await shelf();
  if (!rows.length) throw new Error("The shelves are empty. Connect Plex (Membership card) or add titles in the Returns Slot first.");
  const want = WANT[kind];
  // Unwatched first, then the best rated; ties broken by a daily shuffle so two programmes on the same genre differ.
  const seed = Math.floor(Date.now() / 86_400_000);
  const rank = (r: Row) => (watched.has(r.id) ? 0 : 10) + (r.rating_imdb ?? 6) + ((r.id.charCodeAt(0) * 31 + seed) % 7) / 10;
  const pool = genre ? rows.filter((r) => matches(r, genre)) : rows;
  if (genre && !pool.length) throw new Error(`Nothing on the shelves in ${genre} yet.`);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await claudeCurate(kind, genre, theme, (theme || !genre ? rows : pool).sort((a, b) => rank(b) - rank(a)), watched, want);
    } catch (e) {
      console.error("[programmes] Claude couldn't curate, picking by genre instead:", (e as Error).message);
    }
  }
  const pick = [...pool].sort((a, b) => rank(b) - rank(a)).slice(0, want);
  const name = genre ? titleCase(genre) : pickName(pick);
  return {
    title: kind === "days31" ? `31 Days of ${name}` : `${name} Nights`,
    theme: kind === "days31" ? `One ${name.toLowerCase()} title a night, straight off your shelves.` : `${pick.length} ${name.toLowerCase()} titles from your shelves, unwatched ones first.`,
    essay: null,
    items: pick.map((r) => ({ titleId: r.id, note: null })),
  };
}

const titleCase = (g: string) => g === "SCI-FI" ? "Sci-Fi" : g === "ROM-COM" ? "Rom-Coms" : /^\d{2}S$/.test(g) ? `the '${g.slice(0, 2)}s` : g.charAt(0) + g.slice(1).toLowerCase();
const pickName = (rows: Row[]) => titleCase(rows[0] ? aisleOf(rows[0].kind, rows[0].genres, rows[0].language) : "Cinema");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "theme", "booklet", "picks"],
  properties: {
    title: { type: "string", description: "The programme's name, 1 to 4 words, no year" },
    theme: { type: "string", description: "One or two sentences: what ties it together" },
    booklet: { type: "string", description: "Programme notes, 120 to 220 words in 2 or 3 paragraphs separated by blank lines" },
    picks: {
      type: "array",
      description: "Titles in viewing order",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "note"],
        properties: {
          id: { type: "string", description: "The id of a title from the shelf list, copied exactly" },
          note: { type: "string", description: "One short line on why it's here or what to watch for, under 90 characters" },
        },
      },
    },
  },
};

const SYSTEM = `You programme a small personal video store: themed festivals and 31-day challenges, built only from the titles on the member's own shelves.

Pick only from the shelf list you're given, by copying each title's id exactly. Never suggest anything that isn't on the list. Prefer titles marked unwatched, but a well-loved rewatch can open or close a programme. Put them in a viewing order that builds (an opener, a varied middle, a strong closing night).

Notes and the booklet use only what the shelf list says about each title (year, genres, keywords, director, country, synopsis). Don't add facts, names or dates from memory, and don't reveal endings.`;

async function claudeCurate(kind: AutoKind, genre: string | null, theme: string | null, rows: Row[], watched: Set<string>, want: number): Promise<Curated> {
  const list = rows.slice(0, 400).map((r) => [
    `id=${r.id}`, `${r.title}${r.year ? ` (${r.year})` : ""}`, r.kind === "series" ? "series" : "film",
    r.genres.join("/"), r.keywords.slice(0, 6).join(", "), r.director_or_creator ?? "", r.country ?? "",
    watched.has(r.id) ? "watched" : "unwatched", (r.overview ?? "").slice(0, 160),
  ].join(" | ")).join("\n");
  const ask = kind === "festival"
    ? `A festival of ${want} titles (6 to 12 is fine if the shelves are thin)`
    : `A 31 Days challenge: ${want} titles, one a night (fewer if the shelves don't have enough that fit)`;
  const about = theme ? `on this theme: "${theme}"` : genre ? `in the ${genre} aisle` : "on a theme you choose from what's on the shelves (surprise the member)";

  const response = await new Anthropic().beta.messages.create({
    model: CURATOR_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `<shelf>\n${list}\n</shelf>\n\n${ask}, ${about}.` }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No answer from Claude.");
  const out = JSON.parse(text.text) as { title: string; theme: string; booklet: string; picks: { id: string; note: string }[] };
  // Only ids that are really on the shelves, each once.
  const known = new Set(rows.map((r) => r.id)), seen = new Set<string>();
  const items = out.picks.filter((p) => known.has(p.id) && !seen.has(p.id) && seen.add(p.id)).slice(0, want)
    .map((p) => ({ titleId: p.id, note: p.note?.trim().slice(0, 140) || null }));
  if (items.length < Math.min(4, rows.length)) throw new Error("Claude's picks weren't on the shelves.");
  const title = out.title.trim().slice(0, 60);
  return {
    title: kind === "days31" && !/^31 days/i.test(title) ? `31 Days of ${title}` : title,
    theme: out.theme.trim().slice(0, 400), essay: out.booklet.trim().slice(0, 4000) || null, items,
  };
}
