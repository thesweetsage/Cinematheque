import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { importTitle } from "@/lib/importTitle";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/* POST /api/titles {kind, tmdbId} : adds (or refreshes) a title in the library database. */
export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (db() && !(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!db()) return Response.json({ error: "The database isn't connected yet. Add the Supabase URL and secret key first." }, { status: 503 });
  const { kind, tmdbId } = (await request.json()) as { kind?: string; tmdbId?: number };
  if ((kind !== "movie" && kind !== "tv") || !tmdbId) return Response.json({ error: "kind and tmdbId are required" }, { status: 400 });
  try {
    const saved = await importTitle(kind, tmdbId);
    revalidateTag(CATALOG_TAG, { expire: 0 }); // the shelves show it on the next visit
    return Response.json(saved);
  }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 502 }); }
}
