import { revalidateTag } from "next/cache";
import { suggestLinks } from "@/lib/build/familyTree";
import { CATALOG_TAG } from "@/lib/catalog";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/* POST /api/programmes/tree {title} : asks Claude for more family-tree links from the title's Wikipedia article. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { title } = (await request.json().catch(() => ({}))) as { title?: string };
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });
  try {
    const added = await suggestLinks(title);
    revalidateTag(CATALOG_TAG, { expire: 0 });
    return Response.json({ added });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
