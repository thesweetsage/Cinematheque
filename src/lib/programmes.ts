import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import store from "@/data/sample-store.json";
import { CATALOG_TAG } from "./catalog";
import { db, selectAll } from "./supabase";

/*
 * Programmes (phase 6): Editions (the hall of fame), Festivals and 31 Days of ___.
 * One cached read of every programme with its items and awards (a single member has a few dozen at most),
 * with a sample festival, 31 Days and two editions while the database isn't connected.
 */

export const PROG_TAG = "programmes";
export type ProgType = "edition" | "festival" | "days31";
export type ProgStatus = "draft" | "live" | "archived";
export type ProgItem = { position: number; id: string; date?: string; note?: string; done: boolean; doneAt?: string };
export type Award = { category: string; id?: string; note?: string };
export type Programme = {
  slug: string; type: ProgType; title: string; theme?: string; essay?: string; essayDraft: boolean;
  start?: string; end?: string; accent: string; status: ProgStatus; spine?: number;
  items: ProgItem[]; awards: Award[];
  /** Editions only: the other editions it pairs with (their slugs). */
  pairs: string[];
};
/** `today` is the date the read was made (cached for minutes), so pages never read the clock while rendering. */
export type Programmes = { source: "db" | "sample"; list: Programme[]; today: string };

export const ACCENTS = ["#FF4FB8", "#7EE6FF", "#FFE38A", "#FF9A5C", "#B9B2FF", "#7CFF9E"] as const;
export const TYPE_NAME: Record<ProgType, string> = { edition: "Edition", festival: "Festival", days31: "31 Days" };

export async function getProgrammes(): Promise<Programmes> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PROG_TAG, CATALOG_TAG);
  const client = db();
  if (!client) return sample();
  try {
    return { source: "db", list: await read(), today: today() };
  } catch (e) {
    console.error("[programmes] read failed, showing the sample set:", (e as Error).message);
    return sample();
  }
}

export const findProgramme = (p: Programmes, slug: string) => p.list.find((x) => x.slug === slug);
export const editionOf = (p: Programmes, titleSlug: string) => p.list.find((x) => x.type === "edition" && x.status !== "draft" && x.items[0]?.id === titleSlug);
export const spineLabel = (n?: number) => (n == null ? "" : `No. ${String(n).padStart(3, "0")}`);

/** The member's local date (the server's time zone) as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString("en-CA");
export const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
export const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);

/** 31 Days: the days that got a stamp, and the streak (consecutive stamped days up to today, or up to yesterday if today isn't stamped yet). */
export function stamps(p: Programme, t: string) {
  const byDay = new Map<string, ProgItem[]>();
  for (const it of p.items) if (it.done && it.doneAt) { const d = dayOf(it.doneAt); byDay.set(d, [...(byDay.get(d) ?? []), it]); }
  let streak = 0;
  let d = byDay.has(t) ? t : addDays(t, -1);
  while (byDay.has(d) && (!p.start || d >= p.start)) { streak++; d = addDays(d, -1); }
  const inRange = [...byDay.keys()].filter((k) => (!p.start || k >= p.start) && (!p.end || k <= p.end));
  return { byDay, streak, stamped: inRange.length };
}

/* ---------- Database ---------- */

type Row = {
  id: string; slug: string; type: string; title: string; theme: string | null; essay: string | null; essay_status?: string | null;
  start_date: string | null; end_date: string | null; accent_color: string | null; status: ProgStatus; spine_number: number | null;
};
type ItemRow = { programme_id: string; title_id: string; position: number; slot_date: string | null; programme_note: string | null; done: boolean; done_at?: string | null };

async function read(): Promise<Programme[]> {
  const client = db()!;
  const [rows, items, awards, links, titles] = await Promise.all([
    selectAll<Row>((a, b) => client.from("programmes").select("*").in("type", ["edition", "festival", "days31"]).order("created_at", { ascending: false }).range(a, b)),
    selectAll<ItemRow>((a, b) => client.from("programme_items").select("*").order("position").range(a, b)),
    selectAll<{ programme_id: string; category: string; title_id: string | null; note: string | null }>((a, b) => client.from("awards").select("*").range(a, b)),
    selectAll<{ from_title_id: string; to_title_id: string }>((a, b) => client.from("title_links").select("from_title_id, to_title_id").eq("kind", "pairs_with").range(a, b)),
    selectAll<{ id: string; slug: string }>((a, b) => client.from("titles").select("id, slug").range(a, b)),
  ]);
  const slug = new Map(titles.map((t) => [t.id, t.slug]));
  const itemsOf = new Map<string, ItemRow[]>();
  for (const it of items) itemsOf.set(it.programme_id, [...(itemsOf.get(it.programme_id) ?? []), it]);
  const awardsOf = new Map<string, Award[]>();
  for (const a of awards) awardsOf.set(a.programme_id, [...(awardsOf.get(a.programme_id) ?? []), { category: a.category, id: (a.title_id && slug.get(a.title_id)) || undefined, note: a.note ?? undefined }]);
  const list = rows.map((r): Programme => ({
    slug: r.slug, type: r.type as ProgType, title: r.title, theme: r.theme ?? undefined, essay: r.essay ?? undefined, essayDraft: r.essay_status !== "checked",
    start: r.start_date ?? undefined, end: r.end_date ?? undefined, accent: r.accent_color ?? ACCENTS[0], status: r.status, spine: r.spine_number ?? undefined,
    items: (itemsOf.get(r.id) ?? []).filter((it) => slug.has(it.title_id)).map((it) => ({
      position: it.position, id: slug.get(it.title_id)!, date: it.slot_date ?? undefined, note: it.programme_note ?? undefined, done: it.done, doneAt: it.done_at ?? undefined,
    })),
    awards: awardsOf.get(r.id) ?? [],
    pairs: [],
  }));
  // "Pairs with" links run between the editions' titles.
  const editionByTitle = new Map(list.filter((p) => p.type === "edition" && p.items[0]).map((p) => [p.items[0].id, p]));
  for (const l of links) {
    const a = editionByTitle.get(slug.get(l.from_title_id) ?? ""), b = editionByTitle.get(slug.get(l.to_title_id) ?? "");
    if (a && b) { a.pairs.push(b.slug); b.pairs.push(a.slug); }
  }
  for (const p of list) p.pairs = [...new Set(p.pairs)];
  return list;
}

/* ---------- Sample set ---------- */

function sample(): Programmes {
  const f = store.festival as { name: string; month: string; theme: string; items: { id: string; d: string; done: number; note: string }[]; awards: [string, string][] };
  const date = (d: string) => `2026-10-${d.slice(4).padStart(2, "0")}`;
  const festival: Programme = {
    slug: "isolation", type: "festival", title: f.name, theme: f.theme, essayDraft: false, start: "2026-10-01", end: "2026-10-31",
    accent: "#7EE6FF", status: "live", pairs: [],
    essay: "October on the edge of the map. Eight films about places nobody is coming to help: a research station, an island, a fogbound harbour, a dance academy that locks its doors at night.\n\nWatch them in order and the isolation changes shape. First it's geography, then community, then something closer to a dream.",
    items: f.items.map((it, i) => ({ position: i, id: it.id, date: date(it.d), note: it.note, done: !!it.done, doneAt: it.done ? `${date(it.d)}T21:30:00Z` : undefined })),
    awards: [],
  };
  const horror = ["thing", "fog", "wicker", "halloween", "evildead", "suspiria", "phantasm", "changeling", "hausu", "messiah", "possession", "angelsegg"];
  const done = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const days31: Programme = {
    slug: "31-days-of-horror", type: "days31", title: "31 Days of Horror", theme: "One horror film a night, all October.", essayDraft: false,
    start: "2026-10-01", end: "2026-10-31", accent: "#FF4FB8", status: "live", pairs: [], awards: [],
    items: horror.map((id, i) => ({ position: i, id, done: i < done.length, doneAt: i < done.length ? `2026-10-${String(done[i]).padStart(2, "0")}T22:10:00Z` : undefined })),
  };
  const editions = Object.entries(store.editions as Record<string, string>).map(([id, no]): Programme => ({
    slug: `edition-${no}`, type: "edition", title: id, essayDraft: true, accent: "#FFE38A", status: "live", spine: Number(no), awards: [], pairs: [],
    items: [{ position: 0, id, done: false }],
  }));
  editions[0].pairs = editions.slice(1).map((e) => e.slug);
  if (editions[1]) editions[1].pairs = [editions[0].slug];
  return { source: "sample", list: [festival, days31, ...editions], today: today() };
}
