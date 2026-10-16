import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, createSession, gateOn, readSession } from "@/lib/session";

/*
 * The front door: every page and API route needs the member's session once the database is connected.
 * Pages redirect to /login; API routes answer 401. Server actions and route handlers check again themselves.
 */
export async function proxy(request: NextRequest) {
  if (!gateOn()) return NextResponse.next();
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (request.nextUrl.pathname.startsWith("/api/")) return Response.json({ error: "Sign in first." }, { status: 401 });
    const login = new URL("/login", request.url);
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/") login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }
  const res = NextResponse.next();
  // Sliding renewal: a box used at least once a year never has to sign in again.
  if (session.renew) res.cookies.set(SESSION_COOKIE, await createSession(session.email), cookieOptions(request.nextUrl.protocol === "https:"));
  return res;
}

export const config = {
  // Everything except the login page, Next's own files, sample artwork, the icon, and the timer routes
  // (the hourly timer calls them with its own key; the routes check that key or the session themselves),
  // and the Stremio add-on (Stremio has no cookie; its address carries a secret token the route checks).
  matcher: ["/((?!login|_next/static|_next/image|art/|favicon.ico|api/plex/sync|api/recs/run|api/stremio/).*)"],
};
