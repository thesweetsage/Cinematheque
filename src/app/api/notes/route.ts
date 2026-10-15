import { revalidateTag } from "next/cache";
import { writeNotes } from "@/lib/notes/write";
import { titleTag } from "@/lib/titleExtras";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/*
 * POST /api/notes {slug} : writes (or rewrites) a title's fact cards and liner notes (about a minute).
 * A plain request rather than a server action, so the page and the menu stay usable while Claude writes.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (!(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!slug) return Response.json({ error: "slug is required" }, { status: 400 });
  try {
    await writeNotes(slug);
    revalidateTag(titleTag(slug), { expire: 0 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(`[notes] ${slug}:`, (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
