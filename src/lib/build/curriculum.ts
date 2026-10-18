import "server-only";
import { saveOffShelf } from "../importTitle";
import { lookupTitle, type TmdbKind } from "../tmdb";
import { askJson, hasClaude, pool, saveProgramme } from "./common";

/*
 * Curriculum: a full viewing course from a list you trust (every film in In Search of Darkness, a film school syllabus).
 * You paste the list; Claude tidies it into chapters using only what's in the paste (it never fills gaps from memory),
 * or, without a Claude key, a simple reader does (headings become chapters, "Title (1982)" lines become titles).
 * Every line is matched on TMDB; the course is saved as a draft so you can check the matches before it goes on the
 * Course Shelf. Lines TMDB can't find are kept aside so you can see what's missing.
 */

export type CurriculumAsk = { title: string; source: string; text: string };
type Entry = { title: string; year: number | null; kind: "movie" | "series"; line: string };
type Chapter = { name: string; items: Entry[] };

const MAX_LINES = 400;
const BULLET = /^\s*(?:[-*•–·>]+|\(?\d{1,3}[.)]|#{1,6})\s*/;
const YEARED = /^(.*?)[\s,–-]*[([]?\s*((?:18|19|20)\d{2})\s*[)\]]?\s*(?:[–-].*)?$/;

/** The no-Claude reader: headings (no year, short, ending in ":" or Part/Chapter/Volume/Year...) start chapters. */
export function readList(text: string): Chapter[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, MAX_LINES);
  const chapters: Chapter[] = [];
  let cur: Chapter | null = null;
  for (const raw of lines) {
    const clean = raw.replace(BULLET, "").trim();
    const m = clean.match(YEARED);
    const heading = !m && (/:\s*$/.test(clean) || /^(part|chapter|volume|vol\.|season|section|year|decade|book|unit|week)\b/i.test(clean) || /^#/.test(raw) || (clean === clean.toUpperCase() && /[A-Z]/.test(clean) && clean.length < 50));
    if (heading) { cur = { name: clean.replace(/:\s*$/, ""), items: [] }; chapters.push(cur); continue; }
    const title = (m ? m[1] : clean).replace(/\((?:tv|series|tv series|mini-?series)[^)]*\)/gi, "").replace(/["“”]/g, "").replace(/[\s,–-]+$/, "").trim();
    if (!title) continue;
    if (!cur) { cur = { name: "", items: [] }; chapters.push(cur); }
    cur.items.push({ title, year: m ? Number(m[2]) : null, kind: /\b(series|tv|season)\b/i.test(raw) ? "series" : "movie", line: raw });
  }
  const kept = chapters.filter((c) => c.items.length);
  // No headings at all: a chronological list reads best by year (In Search of Darkness goes year by year).
  if (kept.length === 1 && !kept[0].name) {
    const items = kept[0].items;
    if (items.filter((i) => i.year).length >= items.length * 0.8) {
      const byYear = new Map<string, Entry[]>();
      for (const it of items) { const k = it.year ? String(it.year) : "Other"; byYear.set(k, [...(byYear.get(k) ?? []), it]); }
      return [...byYear.entries()].map(([name, its]) => ({ name, items: its }));
    }
    kept[0].name = "The list";
  }
  return kept.map((c, i) => ({ ...c, name: c.name || `Part ${i + 1}` }));
}

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["chapters"],
  properties: {
    chapters: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["name", "items"],
        properties: {
          name: { type: "string" },
          items: {
            type: "array", items: {
              type: "object", additionalProperties: false, required: ["title", "year", "kind", "line"],
              properties: {
                title: { type: "string", description: "The title as written in the list, tidied (no numbering, no notes)" },
                year: { type: "integer", description: "The year given in the list, or 0 if the list gives none" },
                kind: { type: "string", enum: ["movie", "series"] },
                line: { type: "string", description: "The original line, copied exactly" },
              },
            },
          },
        },
      },
    },
  },
};

async function claudeRead(text: string, source: string): Promise<Chapter[]> {
  const out = await askJson<{ chapters: { name: string; items: (Omit<Entry, "year"> & { year: number })[] }[] }>(
    `You tidy a pasted viewing list into a course for a personal video store. Use only what is in the pasted text: keep every title it lists, in its order, and add nothing. Don't correct titles or years from memory; only tidy formatting (numbering, bullets, trailing notes). Group the titles into chapters following the list's own headings (Part I, Part II...). If it has none, group by the parts the list itself shows (a year, a decade) using only years written in the list; otherwise use one chapter called "The list". Mark a title as a series only if the list says it's a series or TV show.`,
    `Source: ${source || "not given"}\n\n<pasted_list>\n${text.split(/\r?\n/).slice(0, MAX_LINES).join("\n")}\n</pasted_list>`,
    SCHEMA,
    "low",
  );
  return out.chapters.map((c) => ({ name: c.name.trim() || "The list", items: c.items.map((i) => ({ ...i, year: i.year > 1800 ? i.year : null })) })).filter((c) => c.items.length);
}

export async function buildCurriculum(ask: CurriculumAsk): Promise<string> {
  if (!process.env.TMDB_API_KEY) throw new Error("Add TMDB_API_KEY to .env.local: every title is matched on TMDB.");
  if (!ask.text.trim()) throw new Error("Paste the list first.");
  let chapters: Chapter[] = [];
  if (hasClaude()) {
    try { chapters = await claudeRead(ask.text, ask.source); }
    catch (e) { console.error("[curriculum] Claude couldn't read the list, reading it by hand:", (e as Error).message); }
  }
  if (!chapters.length) chapters = readList(ask.text);
  const entries = chapters.flatMap((c) => c.items.map((it) => ({ ...it, chapter: c.name })));
  if (!entries.length) throw new Error("Couldn't find any titles in that list. One title per line, like: The Thing (1982).");

  const found: ({ titleId: string; tmdbId: number } | null)[] = new Array(entries.length).fill(null);
  await pool(entries, 6, async (e, i) => {
    const kinds: TmdbKind[] = e.kind === "series" ? ["tv", "movie"] : ["movie", "tv"];
    for (const k of kinds) {
      const c = await lookupTitle(k, e.title, e.year).catch(() => null);
      if (!c) continue;
      try { found[i] = { titleId: (await saveOffShelf(k, c.tmdbId)).id, tmdbId: c.tmdbId }; } catch (err) { console.error(`[curriculum] couldn't save ${e.title}:`, (err as Error).message); }
      break;
    }
  });
  const seen = new Set<string>();
  const items = entries.flatMap((e, i) => {
    const f = found[i];
    if (!f || seen.has(f.titleId)) return [];
    seen.add(f.titleId);
    return [{ titleId: f.titleId, chapter: e.chapter, note: e.line.slice(0, 300) }];
  });
  if (!items.length) throw new Error("None of those titles could be found on TMDB. Check the spelling and years.");
  const unmatched = entries.filter((_, i) => !found[i]).map((e) => e.line);
  const title = ask.title.trim() || ask.source.trim() || "Curriculum";
  return saveProgramme({
    type: "curriculum", title, status: "draft", accent: "#FFE38A",
    theme: ask.source.trim() ? `From ${ask.source.trim()}.` : null,
    extras: { source: ask.source.trim() || undefined, unmatched }, sourceNote: ask.source.trim() || null,
  }, items);
}
