import { search } from "@/lib/tmdb";

/* GET /api/search?q=… : films and series from TMDB. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });
  try { return Response.json({ results: await search(q) }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 502 }); }
}
