import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { tickFromWatches } from "@/lib/programmeTick";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/*
 * "Did you finish it?" for titles opened in Stremio (Stremio can't tell the app what was watched).
 *   GET                                  the oldest open question, once it's a few minutes old (or null)
 *   POST {action:"open", slug}           Open in Stremio was pressed: remember to ask
 *   POST {action:"answer", id, answer, rating?}
 *        answer "yes"      logs a watch (with the stars, if given) and ticks it off any running programme
 *        answer "later"    asks again next time
 *        answer "dropped"  forgets it
 * Plain requests rather than server actions, so a page change is never held up by them.
 */
const ASK_AFTER_MIN = 3;

async function member(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  return !!(await readSession(cookie));
}

type CheckRow = { id: string; opened_at: string; titles: { slug: string; title: string; year: number | null; kind: string; poster_url: string | null } | null };

export async function GET(request: Request) {
  const client = db();
  if (!client || !(await member(request))) return Response.json({ check: null });
  const before = new Date(Date.now() - ASK_AFTER_MIN * 60_000).toISOString();
  const { data, error } = await client.from("pending_checks").select("id, opened_at, titles(slug, title, year, kind, poster_url)")
    .lte("opened_at", before).order("opened_at").limit(1).maybeSingle();
  if (error) return Response.json({ check: null, error: error.message });
  const row = data as unknown as CheckRow | null;
  if (!row?.titles) return Response.json({ check: null });
  const t = row.titles;
  return Response.json({ check: { id: row.id, slug: t.slug, title: t.title, year: t.year, kind: t.kind, poster: t.poster_url } });
}

export async function POST(request: Request) {
  const client = db();
  if (!client) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await member(request))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; slug?: string; id?: string; answer?: string; rating?: number };
  try {
    if (body.action === "open") {
      const { data: t } = await client.from("titles").select("id").eq("slug", body.slug ?? "").maybeSingle();
      if (!t) return Response.json({ error: "That title isn't in the store." }, { status: 404 });
      const titleId = (t as { id: string }).id;
      // One question per title: opening it again just restarts the clock.
      await client.from("pending_checks").delete().eq("title_id", titleId);
      const { error } = await client.from("pending_checks").insert({ title_id: titleId });
      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
    }
    if (body.action === "answer" && body.id) {
      const { data: c } = await client.from("pending_checks").select("id, title_id, episode_id").eq("id", body.id).maybeSingle();
      if (!c) return Response.json({ ok: true }); // already answered (another tab)
      const check = c as { id: string; title_id: string; episode_id: string | null };
      if (body.answer === "later") {
        const { error } = await client.from("pending_checks").update({ opened_at: new Date().toISOString() }).eq("id", check.id);
        if (error) throw new Error(error.message);
        return Response.json({ ok: true });
      }
      if (body.answer === "yes") {
        const rating = Number.isInteger(body.rating) && body.rating! >= 1 && body.rating! <= 5 ? body.rating : null;
        const watch = { title_id: check.title_id, episode_id: check.episode_id, watched_at: new Date().toISOString(), source: "manual" as const, rating };
        const { error } = await client.from("watches").insert(watch);
        // Already logged by hand today: keep that one, but take the new stars.
        if (error?.code === "23505") {
          if (rating) await client.from("watches").update({ rating }).eq("title_id", check.title_id).eq("source", "manual").gte("watched_at", watch.watched_at.slice(0, 10));
        } else if (error) throw new Error(error.message);
        await tickFromWatches([watch]);
      }
      const { error } = await client.from("pending_checks").delete().eq("id", check.id);
      if (error) throw new Error(error.message);
      if (body.answer === "yes") revalidateTag(CATALOG_TAG, { expire: 0 });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown request." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
