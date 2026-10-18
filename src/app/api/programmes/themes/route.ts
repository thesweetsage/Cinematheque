import { revalidateTag } from "next/cache";
import { writeThemes } from "@/lib/build/retrospective";
import { PROG_TAG } from "@/lib/programmes";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/* POST /api/programmes/themes {slug} : (re)writes a retrospective's "Themes to watch for" card with Claude. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!slug) return Response.json({ error: "slug is required" }, { status: 400 });
  try {
    await writeThemes(slug);
    revalidateTag(PROG_TAG, { expire: 0 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
