import { revalidateTag } from "next/cache";
import { buildProgramme, DECADES, GENRES, type AutoKind } from "@/lib/autoProgramme";
import { CATALOG_TAG } from "@/lib/catalog";
import { PROG_TAG } from "@/lib/programmes";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/*
 * POST /api/programmes/auto {kind, genre?, decade?, theme?} : builds a festival or a 31 Days and answers with its slug.
 * A plain request rather than a server action, so the page (and the menu) stay usable while it works (up to a minute).
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { kind?: string; genre?: string; decade?: number; theme?: string };
  const kind: AutoKind = b.kind === "days31" ? "days31" : "festival";
  const genre = GENRES.some((g) => g.key === b.genre) ? b.genre! : null;
  const decade = DECADES.includes(Number(b.decade)) ? Number(b.decade) : null;
  const theme = typeof b.theme === "string" ? b.theme.trim().slice(0, 200) || null : null;
  try {
    const slug = await buildProgramme({ kind, genre, decade, theme });
    revalidateTag(PROG_TAG, { expire: 0 });
    revalidateTag(CATALOG_TAG, { expire: 0 });
    return Response.json({ slug });
  } catch (e) {
    console.error("[programmes] build failed:", (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
