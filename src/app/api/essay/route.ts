import { revalidateTag } from "next/cache";
import { writeEssay } from "@/lib/editionEssay";
import { CATALOG_TAG } from "@/lib/catalog";
import { PROG_TAG } from "@/lib/programmes";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/* POST /api/essay {slug} : drafts an edition's essay with Claude (about a minute), as a plain request so the page stays usable. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!slug) return Response.json({ error: "slug is required" }, { status: 400 });
  try {
    await writeEssay(slug);
    revalidateTag(PROG_TAG, { expire: 0 });
    revalidateTag(CATALOG_TAG, { expire: 0 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[essay] ${slug}:`, (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
