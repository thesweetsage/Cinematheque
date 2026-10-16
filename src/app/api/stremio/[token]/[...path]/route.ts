import { buildAddon, tokenOk } from "@/lib/stremio";

/*
 * The Stremio add-on protocol: GET manifest.json and catalog/<type>/<id>[/<extra>].json, open to any origin.
 * The token in the path stands in for the sign-in (see src/lib/stremio.ts); a wrong one is a plain 404.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, OPTIONS" };
const json = (body: object, status = 200, maxAge = 60) =>
  Response.json(body, { status, headers: { ...CORS, "cache-control": status === 200 ? `max-age=${maxAge}` : "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ token: string; path: string[] }> }) {
  const { token, path } = await params;
  if (!tokenOk(token)) return json({ err: "Not found" }, 404);
  const origin = new URL(request.url).origin;
  const addon = await buildAddon(origin);
  const p = path.map(decodeURIComponent).join("/");
  if (p === "manifest.json") return json(addon.manifest);
  const m = p.match(/^catalog\/(movie|series)\/([^/]+?)(?:\/([^/]+))?\.json$/);
  if (!m) return json({ err: "Not found" }, 404);
  const extra = Object.fromEntries(new URLSearchParams(m[3] ?? ""));
  try {
    return json(await addon.get("catalog", m[1], m[2], extra));
  } catch {
    return json({ metas: [] });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
