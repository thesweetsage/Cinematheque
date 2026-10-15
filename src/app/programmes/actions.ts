"use server";
import { updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { slugify } from "@/lib/importTitle";
import { requireMember } from "@/lib/member";
import { ACCENTS, PROG_TAG, type ProgStatus } from "@/lib/programmes";
import { db } from "@/lib/supabase";

/* Everything that changes a programme: create, details, titles, ticks, awards, status, editions and their essays. */

type Result = { error?: string };
const fail = (e: unknown): Result => ({ error: (e as Error).message });
const refresh = () => { updateTag(PROG_TAG); updateTag(CATALOG_TAG); };

function client() {
  const c = db();
  if (!c) throw new Error("The database isn't connected yet.");
  return c;
}
async function programmeId(slug: string) {
  const { data, error } = await client().from("programmes").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That programme isn't in the store.");
  return (data as { id: string }).id;
}
async function titleId(slug: string) {
  const { data, error } = await client().from("titles").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That title isn't in the store.");
  return (data as { id: string }).id;
}
const ymd = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const text = (v: FormDataEntryValue | null, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Starts a festival or a 31 Days by hand. Returns its slug. */
export async function createProgramme(form: FormData): Promise<Result & { slug?: string }> {
  await requireMember();
  try {
    const type = form.get("type") === "days31" ? "days31" : "festival";
    const title = text(form.get("title"), 120);
    if (!title) return { error: "Give it a name." };
    const start = ymd(form.get("start"));
    if (!start) return { error: "Pick a start date." };
    const end = ymd(form.get("end")) ?? start;
    if (end < start) return { error: "The end date is before the start date." };
    const accent = (ACCENTS as readonly string[]).includes(String(form.get("accent"))) ? String(form.get("accent")) : ACCENTS[0];
    const base = slugify(title, Number(start.slice(0, 4)));
    for (const slug of [base, `${base}-${start.slice(5, 7)}`, `${base}-${Date.now().toString(36)}`]) {
      const { error } = await client().from("programmes").insert({
        type, title, slug, theme: text(form.get("theme"), 600) || null, start_date: start, end_date: end, accent_color: accent, status: "live",
      });
      if (!error) { refresh(); return { slug }; }
      if (error.code !== "23505") return { error: error.message };
    }
    return { error: "Couldn't find a free name for it. Try another." };
  } catch (e) { return fail(e); }
}

export async function updateDetails(slug: string, form: FormData): Promise<Result> {
  await requireMember();
  try {
    const title = text(form.get("title"), 120);
    if (!title) return { error: "Give it a name." };
    const start = ymd(form.get("start")), end = ymd(form.get("end"));
    if (start && end && end < start) return { error: "The end date is before the start date." };
    const accent = String(form.get("accent"));
    const { error } = await client().from("programmes").update({
      title, theme: text(form.get("theme"), 600) || null, essay: text(form.get("essay"), 12000) || null,
      start_date: start, end_date: end, ...((ACCENTS as readonly string[]).includes(accent) ? { accent_color: accent } : {}),
    }).eq("slug", slug);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

export async function setStatus(slug: string, status: ProgStatus): Promise<Result> {
  await requireMember();
  try {
    const { error } = await client().from("programmes").update({ status }).eq("slug", slug);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

export async function deleteProgramme(slug: string): Promise<Result> {
  await requireMember();
  try {
    const { error } = await client().from("programmes").delete().eq("slug", slug).neq("type", "edition");
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

/** Adds a title at the end of the programme, with an optional date and note. */
export async function addItem(slug: string, titleSlug: string, date?: string, note?: string): Promise<Result> {
  await requireMember();
  try {
    const pid = await programmeId(slug), tid = await titleId(titleSlug);
    const { data: last } = await client().from("programme_items").select("position").eq("programme_id", pid).order("position", { ascending: false }).limit(1).maybeSingle();
    const position = ((last as { position: number } | null)?.position ?? -1) + 1;
    const { error } = await client().from("programme_items").insert({ programme_id: pid, title_id: tid, position, slot_date: date || null, programme_note: note?.trim() || null });
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

export async function updateItem(slug: string, position: number, date: string | null, note: string | null): Promise<Result> {
  await requireMember();
  try {
    const pid = await programmeId(slug);
    const { error } = await client().from("programme_items").update({ slot_date: date || null, programme_note: note?.trim() || null }).eq("programme_id", pid).eq("position", position);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

export async function removeItem(slug: string, position: number): Promise<Result> {
  await requireMember();
  try {
    const pid = await programmeId(slug);
    const { error } = await client().from("programme_items").delete().eq("programme_id", pid).eq("position", position);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

/** Swaps an item with its neighbour (positions are the primary key, so it goes through a free slot). */
export async function moveItem(slug: string, position: number, dir: -1 | 1): Promise<Result> {
  await requireMember();
  try {
    const pid = await programmeId(slug);
    const { data, error } = await client().from("programme_items").select("position").eq("programme_id", pid).order("position");
    if (error) return { error: error.message };
    const positions = (data as { position: number }[]).map((r) => r.position);
    const other = positions[positions.indexOf(position) + dir];
    if (other === undefined) return {};
    const tmp = Math.max(...positions) + 1;
    const set = async (from: number, to: number) => {
      const { error: e } = await client().from("programme_items").update({ position: to }).eq("programme_id", pid).eq("position", from);
      if (e) throw new Error(e.message);
    };
    await set(position, tmp); await set(other, position); await set(tmp, other);
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

/** Ticks an item off by hand (or un-ticks it). A hand tick is dated now. */
export async function setDone(slug: string, position: number, done: boolean): Promise<Result> {
  await requireMember();
  try {
    const pid = await programmeId(slug);
    const { error } = await client().from("programme_items").update({ done, done_at: done ? new Date().toISOString() : null }).eq("programme_id", pid).eq("position", position);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

/** Jury awards: one winner per category. An empty title removes the award. */
export async function setAward(slug: string, category: string, titleSlug: string | null, note: string): Promise<Result> {
  await requireMember();
  try {
    const cat = category.trim().slice(0, 60);
    if (!cat) return { error: "Name the award." };
    const pid = await programmeId(slug);
    const { error } = titleSlug
      ? await client().from("awards").upsert({ programme_id: pid, category: cat, title_id: await titleId(titleSlug), note: note.trim() || null })
      : await client().from("awards").delete().eq("programme_id", pid).eq("category", cat);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

/* ---------- Editions ---------- */

/** Inducts a title into the collection: the next spine number, a place on the Staff Picks shelf, and an essay draft. */
export async function induct(titleSlug: string): Promise<Result & { slug?: string }> {
  await requireMember();
  try {
    const tid = await titleId(titleSlug);
    const { data: existing } = await client().from("programme_items").select("programmes!inner(slug, type)").eq("title_id", tid).eq("programmes.type", "edition").limit(1).maybeSingle();
    const ex = existing as { programmes: { slug: string } | { slug: string }[] } | null;
    if (ex) return { slug: (Array.isArray(ex.programmes) ? ex.programmes[0] : ex.programmes).slug };
    const { data: t } = await client().from("titles").select("title").eq("id", tid).single();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: top } = await client().from("programmes").select("spine_number").eq("type", "edition").not("spine_number", "is", null).order("spine_number", { ascending: false }).limit(1).maybeSingle();
      const spine = ((top as { spine_number: number } | null)?.spine_number ?? 0) + 1;
      const slug = `edition-${String(spine).padStart(3, "0")}`;
      const { data: p, error } = await client().from("programmes").insert({
        type: "edition", title: (t as { title: string }).title, slug, spine_number: spine, status: "live", accent_color: "#FFE38A",
      }).select("id").single();
      if (error?.code === "23505") continue; // someone took that number a moment ago
      if (error) return { error: error.message };
      const { error: e2 } = await client().from("programme_items").insert({ programme_id: (p as { id: string }).id, title_id: tid, position: 0 });
      if (e2) return { error: e2.message };
      refresh();
      return { slug };
    }
    return { error: "Couldn't get a spine number. Try again." };
  } catch (e) { return fail(e); }
}

export async function saveEssay(slug: string, essay: string, checked: boolean): Promise<Result> {
  await requireMember();
  try {
    const { error } = await client().from("programmes").update({ essay: essay.trim().slice(0, 12000) || null, essay_status: checked ? "checked" : "draft" }).eq("slug", slug).eq("type", "edition");
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) { return fail(e); }
}

/** "Pairs with": links two editions' titles both ways. */
export async function setPair(slug: string, otherSlug: string, on: boolean): Promise<Result> {
  await requireMember();
  try {
    const first = async (s: string) => {
      const { data, error } = await client().from("programmes").select("programme_items(title_id)").eq("slug", s).eq("type", "edition").single();
      if (error) throw new Error(error.message);
      const id = (data as { programme_items: { title_id: string }[] }).programme_items[0]?.title_id;
      if (!id) throw new Error("That edition has no title.");
      return id;
    };
    const [a, b] = await Promise.all([first(slug), first(otherSlug)]);
    const rows = [{ from_title_id: a, to_title_id: b, kind: "pairs_with", verified: true }, { from_title_id: b, to_title_id: a, kind: "pairs_with", verified: true }];
    if (on) {
      const { error } = await client().from("title_links").upsert(rows);
      if (error) return { error: error.message };
    } else {
      for (const r of rows) {
        const { error } = await client().from("title_links").delete().eq("from_title_id", r.from_title_id).eq("to_title_id", r.to_title_id).eq("kind", "pairs_with");
        if (error) return { error: error.message };
      }
    }
    refresh();
    return {};
  } catch (e) { return fail(e); }
}
