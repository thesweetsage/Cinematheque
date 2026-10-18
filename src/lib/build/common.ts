import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { slugify } from "../importTitle";
import type { ProgExtras, ProgType } from "../programmes";
import { db } from "../supabase";

/*
 * What the v2 programme builders share (src/lib/build/*): Claude with JSON or text answers, saving a programme with its
 * items under a free slug, and small helpers. Claude only ever works from the sources it's handed (Wikipedia text,
 * the member's pasted list, TMDB details), and every title it names is looked up on TMDB before it's kept.
 */

export const BUILD_MODEL = "claude-opus-5-5";
export const hasClaude = () => !!process.env.ANTHROPIC_API_KEY;

type Effort = "low" | "medium" | "high";

async function create(system: string, user: string, effort: Effort, schema?: Record<string, unknown>) {
  const response = await new Anthropic().beta.messages.create({
    model: BUILD_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: schema ? { effort, format: { type: "json_schema", schema } } : { effort },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room. Try a shorter list.");
  const text = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!text) throw new Error("No answer from Claude.");
  return text;
}

/** Claude, answering in JSON that matches `schema`. */
export async function askJson<T>(system: string, user: string, schema: Record<string, unknown>, effort: Effort = "low"): Promise<T> {
  return JSON.parse(await create(system, user, effort, schema)) as T;
}

/** Claude, answering in plain prose. */
export const askText = (system: string, user: string, effort: Effort = "medium") => create(system, user, effort);

/** Runs `fn` over `items`, `size` at a time. */
export async function pool<T>(items: T[], size: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
}

export const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
export const todayYmd = () => new Date().toLocaleDateString("en-CA");

export type NewProgramme = {
  type: ProgType; title: string; theme?: string | null; essay?: string | null; start?: string | null; end?: string | null;
  accent: string; status: "draft" | "live"; extras?: ProgExtras; sourceNote?: string | null;
};
export type NewItem = { titleId: string; episodeId?: string | null; chapter?: string | null; date?: string | null; note?: string | null };

export function client() {
  const c = db();
  if (!c) throw new Error("The database isn't connected yet.");
  return c;
}

/** Saves a programme and its items under a free slug. Returns the slug. */
export async function saveProgramme(p: NewProgramme, items: NewItem[]): Promise<string> {
  const c = client();
  const year = Number((p.start ?? todayYmd()).slice(0, 4));
  const base = slugify(p.title, year);
  for (const slug of [base, `${base}-${todayYmd().slice(5, 7)}`, `${base}-${Date.now().toString(36)}`]) {
    const { data, error } = await c.from("programmes").insert({
      type: p.type, title: p.title, slug, theme: p.theme ?? null, essay: p.essay ?? null, start_date: p.start ?? null, end_date: p.end ?? null,
      accent_color: p.accent, status: p.status, extras: p.extras ?? {}, source_note: p.sourceNote ?? null,
    }).select("id").single();
    if (error?.code === "23505") continue;
    if (error) throw new Error(error.message);
    const pid = (data as { id: string }).id;
    const rows = items.map((it, i) => ({
      programme_id: pid, title_id: it.titleId, episode_id: it.episodeId ?? null, position: i, chapter: it.chapter ?? null,
      slot_date: it.date ?? null, programme_note: it.note ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e } = await c.from("programme_items").insert(rows.slice(i, i + 500));
      if (e) { await c.from("programmes").delete().eq("id", pid); throw new Error(e.message); }
    }
    return slug;
  }
  throw new Error("Couldn't find a free name for it. Try again.");
}

/** Merges keys into a programme's extras. */
export async function setExtras(slug: string, patch: Partial<ProgExtras>) {
  const c = client();
  const { data, error } = await c.from("programmes").select("extras").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That programme isn't in the store.");
  const { error: e } = await c.from("programmes").update({ extras: { ...((data as { extras: ProgExtras }).extras ?? {}), ...patch } }).eq("slug", slug);
  if (e) throw new Error(e.message);
}
