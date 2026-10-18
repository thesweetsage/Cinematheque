import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { PROG_TAG } from "@/lib/programmes";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { buildV2 } from "@/lib/build";

/*
 * POST /api/programmes/build {type, ...} : builds a v2 programme (marathon, curriculum, retrospective, family tree,
 * year in a decade, essay series) and answers with its slug. A plain request rather than a server action, so the page
 * and the menu stay usable while it works (a long curriculum takes a minute or two).
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const slug = await buildV2(body);
    revalidateTag(PROG_TAG, { expire: 0 });
    revalidateTag(CATALOG_TAG, { expire: 0 });
    return Response.json({ slug });
  } catch (e) {
    console.error(`[programmes] ${String(body.type)} build failed:`, (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
