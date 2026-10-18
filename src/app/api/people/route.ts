import { searchPeople } from "@/lib/tmdb";
import { SESSION_COOKIE, gateOn, readSession } from "@/lib/session";

/* GET /api/people?q=name : people on TMDB, directors first (for starting a retrospective). */
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (gateOn() && !(await readSession(cookie))) return Response.json({ error: "Sign in first." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100);
  if (!q) return Response.json({ people: [] });
  try { return Response.json({ people: await searchPeople(q) }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 502 }); }
}
