import { revalidateTag } from "next/cache";
import { importTitle } from "@/lib/importTitle";
import { db } from "@/lib/supabase";

/* POST /api/titles {kind, tmdbId} : adds (or refreshes) a title in the library database. */
export async function POST(request: Request) {
  if (!db()) return Response.json({ error: "The database isn't connected yet. Add the Supabase URL and secret key first." }, { status: 503 });
  const { kind, tmdbId } = (await request.json()) as { kind?: string; tmdbId?: number };
  if ((kind !== "movie" && kind !== "tv") || !tmdbId) return Response.json({ error: "kind and tmdbId are required" }, { status: 400 });
  try {
    const saved = await importTitle(kind, tmdbId);
    revalidateTag("titles", { expire: 0 });
    return Response.json(saved);
  }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 502 }); }
}
