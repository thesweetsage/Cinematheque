import { after } from "next/server";
import { db } from "@/lib/supabase";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { recsOnce, recsRunning } from "@/lib/recs/engine";

/*
 * POST /api/recs/run : starts the recommendations run in the background and answers straight away.
 * The hourly timer (src/instrumentation.ts) calls it with the per-boot key; it only runs when the last good run is
 * 20+ hours old, so in practice once a night. The signed-in member can force a run (?force=1) from the Membership card.
 */
export async function POST(request: Request) {
  const timer = !!process.env.CINE_TIMER_KEY && request.headers.get("x-cine-timer") === process.env.CINE_TIMER_KEY;
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!timer && db() && !(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!db()) return Response.json({ error: "The database isn't connected yet." }, { status: 503 });
  if (recsRunning()) return Response.json({ started: false, running: true });
  const force = !timer && new URL(request.url).searchParams.get("force") === "1";
  after(() => recsOnce(force));
  return Response.json({ started: true });
}
