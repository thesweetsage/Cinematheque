import { buildTitleRow } from "@/lib/importTitle";
import { rowToTitle } from "@/lib/rowToTitle";

/* GET /api/preview?kind=movie|tv&id=… : what the title would look like in the store (metadata, ratings, generated spine). Saves nothing. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const kind = p.get("kind"), id = Number(p.get("id"));
  if ((kind !== "movie" && kind !== "tv") || !id) return Response.json({ error: "kind and id are required" }, { status: 400 });
  try { return Response.json(rowToTitle(await buildTitleRow(kind, id))); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 502 }); }
}
