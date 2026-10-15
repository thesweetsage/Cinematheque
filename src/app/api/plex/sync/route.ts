import { after } from "next/server";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { syncOnce, syncState } from "@/lib/plex/sync";

/*
 * POST /api/plex/sync : starts a Plex sync in the background and answers straight away.
 * Called by the hourly timer (src/instrumentation.ts, with the per-boot key) or by the signed-in member.
 */
export async function POST(request: Request) {
  const timer = !!process.env.CINE_TIMER_KEY && request.headers.get("x-cine-timer") === process.env.CINE_TIMER_KEY;
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!timer && db() && !(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (syncState().running) return Response.json({ started: false, running: true });
  after(() => syncOnce());
  return Response.json({ started: true });
}
