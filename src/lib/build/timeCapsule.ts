import "server-only";
import { saveOffShelf } from "../importTitle";
import { articleByTitle } from "../notes/wikipedia";
import { ACCENTS, type ProgExtras } from "../programmes";
import { selectAll } from "../supabase";
import { discover, type Candidate } from "../tmdb";
import { addDays, askJson, client, hasClaude, pool, saveProgramme, setExtras } from "./common";

/*
 * Year in a decade: one year (1974, 1997...) as a month-long programme. Films and a couple of series from that year
 * (from TMDB, with what's on your Plex first among equals), spread over four weeks, plus what was on the radio, in the
 * news and being worn that year: notes Claude writes only from Wikipedia's "<year> in music", "<year>" and
 * "<decade>s in fashion" articles (a draft until checked).
 */

export type CapsuleAsk = { year: number; start: string };
const FILMS = 10, SERIES = 2;

type Pick = Candidate & { libId?: string; onPlex: boolean; watched: boolean };

async function marks() {
  const c = client();
  const [rows, watches] = await Promise.all([
    selectAll<{ id: string; tmdb_id: number | null; kind: string; on_plex: boolean }>((a, b) => c.from("titles").select("id, tmdb_id, kind, on_plex").range(a, b)),
    selectAll<{ title_id: string }>((a, b) => c.from("watches").select("title_id").range(a, b)),
  ]);
  const seen = new Set(watches.map((w) => w.title_id));
  return new Map(rows.filter((r) => r.tmdb_id).map((r) => [`${r.kind}:${r.tmdb_id}`, { id: r.id, onPlex: r.on_plex, watched: seen.has(r.id) }]));
}

/** The year's best known and best rated, with a few lesser-known ones; unwatched and on-Plex first among equals. */
function choose(pool_: Pick[], n: number) {
  const score = (p: Pick) => (p.watched ? -3 : 0) + (p.onPlex ? 1 : 0) + p.avg + Math.log10(Math.max(10, p.votes)) * 0.7;
  const famous = [...pool_].sort((a, b) => b.votes - a.votes).slice(0, Math.ceil(n * 0.7));
  const rest = [...pool_].filter((p) => !famous.includes(p)).sort((a, b) => score(b) - score(a)).slice(0, n - famous.length);
  return [...famous, ...rest].sort((a, b) => score(b) - score(a));
}

export async function buildTimeCapsule(ask: CapsuleAsk): Promise<string> {
  if (!process.env.TMDB_API_KEY) throw new Error("Add TMDB_API_KEY to .env.local: the films come from TMDB.");
  const y = ask.year, thisYear = new Date().getFullYear();
  if (!Number.isInteger(y) || y < 1920 || y >= thisYear) throw new Error(`Pick a year between 1920 and ${thisYear - 1}.`);
  const known = await marks();
  const mark = (c: Candidate): Pick => { const k = known.get(`${c.kind === "tv" ? "series" : "movie"}:${c.tmdbId}`); return { ...c, libId: k?.id, onPlex: !!k?.onPlex, watched: !!k?.watched }; };
  const base = { after: y, before: y };
  const [f1, f2, f3, s1] = await Promise.all([
    discover("movie", { ...base, minVotes: 100, sort: "vote_count.desc", page: 1 }).catch(() => []),
    discover("movie", { ...base, minVotes: 100, sort: "vote_count.desc", page: 2 }).catch(() => []),
    discover("movie", { ...base, minVotes: 60, page: 1 }).catch(() => []),
    discover("tv", { ...base, minVotes: 40, sort: "vote_count.desc", page: 1 }).catch(() => []),
  ]);
  const uniq = (l: Candidate[]) => [...new Map(l.map((c) => [c.tmdbId, c])).values()].map(mark);
  const films = choose(uniq([...f1, ...f2, ...f3]), FILMS), series = choose(uniq(s1), SERIES);
  if (!films.length) throw new Error(`TMDB has no films from ${y}.`);
  const picks = [...films, ...series];
  const ids: (string | null)[] = new Array(picks.length).fill(null);
  await pool(picks, 4, async (p, i) => {
    try { ids[i] = p.libId ?? (await saveOffShelf(p.kind, p.tmdbId)).id; } catch (e) { console.error(`[capsule] couldn't save ${p.title}:`, (e as Error).message); }
  });
  const kept = picks.map((p, i) => ({ p, id: ids[i] })).filter((x): x is { p: Pick; id: string } => !!x.id);
  const n = kept.length, days = 28;
  const items = kept.map(({ id }, i) => ({ titleId: id, date: addDays(ask.start, n > 1 ? Math.round((i * (days - 1)) / (n - 1)) : 0) }));
  const slug = await saveProgramme({
    type: "time_capsule", title: `Time capsule: ${y}`, start: ask.start, end: addDays(ask.start, days - 1), status: "live",
    accent: ACCENTS[y % ACCENTS.length], theme: `${y} for a month: ${films.length} films and ${series.length ? `${series.length} series` : "no series"} from that year, with what was on the radio, in the news and being worn.`,
    extras: { year: y },
  }, items);
  if (hasClaude()) await writeCapsule(slug).catch((e) => console.error("[capsule] notes:", (e as Error).message));
  return slug;
}

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["albums", "events", "fashion"],
  properties: {
    albums: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "artist", "note"], properties: { title: { type: "string" }, artist: { type: "string" }, note: { type: "string", description: "Under 90 characters" } } } },
    events: { type: "array", items: { type: "string", description: "One event, under 120 characters" } },
    fashion: { type: "array", items: { type: "string", description: "One look or trend, under 120 characters" } },
  },
};

/** Writes (or rewrites) the year's radio / news / fashion notes from Wikipedia. */
export async function writeCapsule(slug: string) {
  if (!hasClaude()) throw new Error("Add ANTHROPIC_API_KEY to .env.local to write the notes.");
  const { data, error } = await client().from("programmes").select("extras").eq("slug", slug).eq("type", "time_capsule").maybeSingle();
  if (error) throw new Error(error.message);
  const y = (data as { extras: ProgExtras } | null)?.extras?.year;
  if (!y) throw new Error("That time capsule isn't in the store.");
  const decade = Math.floor(y / 10) * 10;
  const [music, events, fashion] = await Promise.all([`${y} in music`, String(y), `${decade}s in fashion`].map((t) => articleByTitle(t).catch(() => null)));
  const articles = [music, events, fashion].filter((a): a is NonNullable<typeof a> => !!a);
  if (!articles.length) throw new Error("Couldn't reach Wikipedia for that year's articles.");
  const out = await askJson<{ albums: { title: string; artist: string; note: string }[]; events: string[]; fashion: string[] }>(
    `You fill a time capsule for one year in a personal video store: what was on the radio, what was in the news, what people wore. Use only the Wikipedia articles you're given; never add anything from memory. Albums: 6 to 8 notable albums released that year with their artists. Events: 6 to 8 notable events of that year, plain and neutral. Fashion: 4 to 6 looks or trends the fashion article ties to around that year (if it only covers the decade, say so in the wording). Leave a list short or empty rather than inventing.`,
    `${articles.map((a) => `<wikipedia_article title="${a.title}">\n${a.text.slice(0, 40000)}\n</wikipedia_article>`).join("\n\n")}\n\nThe year: ${y}.`,
    SCHEMA,
  );
  await setExtras(slug, { capsule: { albums: out.albums.slice(0, 8), events: out.events.slice(0, 8), fashion: out.fashion.slice(0, 6), sources: articles.map((a) => a.url), draft: true } });
}
