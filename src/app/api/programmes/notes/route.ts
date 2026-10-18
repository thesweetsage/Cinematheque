import { revalidateTag } from "next/cache";
import { writeItemEssay } from "@/lib/build/essaySeries";
import { writeCapsule } from "@/lib/build/timeCapsule";
import { PROG_TAG } from "@/lib/programmes";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/*
 * POST /api/programmes/notes : Claude writing for the v2 programmes, as a plain request so the app stays usable.
 *   {kind:"capsule", slug}            a year's radio / news / fashion notes
 *   {kind:"essay", slug, position}    one essay in an essay series
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { kind?: string; slug?: string; position?: number };
  if (!b.slug) return Response.json({ error: "slug is required" }, { status: 400 });
  try {
    if (b.kind === "capsule") await writeCapsule(b.slug);
    else if (b.kind === "essay" && Number.isInteger(b.position)) await writeItemEssay(b.slug, b.position!);
    else return Response.json({ error: "Unknown request." }, { status: 400 });
    revalidateTag(PROG_TAG, { expire: 0 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
