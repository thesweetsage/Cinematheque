// The Cinematheque's Stremio add-on, served by Supabase over https (Stremio only loads https add-ons from other devices).
// Same catalogues as the app's /api/stremio route (src/lib/stremio.ts): every running festival and 31 Days in programme
// order, and the collection. It reads the database directly, so it works whether the app runs on the PC or the NAS.
//
// Address: https://<project>.supabase.co/functions/v1/stremio/<token>/manifest.json
// The token is the one the app shows on the Membership card (saved in app_settings under "stremio").
// Deploy with JWT verification OFF (Stremio can't send a Supabase key): see README, "Stremio".

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, OPTIONS" };

type Kind = "movie" | "series";
type T = { kind: Kind; imdb_id: string | null; title: string; year: number | null; overview: string | null; poster_url: string | null };
type Item = { position: number; slot_date: string | null; programme_note: string | null; titles: T | null };
type P = { slug: string; title: string; type: string; status: string; start_date: string | null; end_date: string | null; spine_number: number | null; programme_items: Item[] };
type Shelf = { id: string; name: string; type: Kind; items: { t: T; note: string | null }[] };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": status === 200 ? "max-age=60" : "no-store" } });

async function rest<R>(path: string): Promise<R> {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function tokenOk(token: string) {
  const rows = await rest<{ value: { token?: string } }[]>("app_settings?key=eq.stremio&select=value");
  const want = rows[0]?.value?.token;
  if (!want || want.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

async function shelves(): Promise<Shelf[]> {
  const today = new Date().toISOString().slice(0, 10);
  const progs = await rest<P[]>("programmes?select=slug,title,type,status,start_date,end_date,spine_number," +
    "programme_items(position,slot_date,programme_note,titles(kind,imdb_id,title,year,overview,poster_url))&status=neq.draft");
  const out: Shelf[] = [];
  const add = (id: string, name: string, items: Item[]) => {
    const found = items.filter((it) => it.titles?.imdb_id).map((it) => ({ t: it.titles!, note: it.programme_note }));
    for (const type of ["movie", "series"] as const) {
      const mine = found.filter((x) => x.t.kind === type);
      if (mine.length) out.push({ id: `${id}-${type}`, name, type, items: mine });
    }
  };
  const order = (items: Item[]) => [...items].sort((a, b) => (a.slot_date ?? "9999").localeCompare(b.slot_date ?? "9999") || a.position - b.position);
  progs.filter((p) => (p.type === "festival" || p.type === "days31") && p.status === "live" && (!p.end_date || p.end_date >= today))
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
    .forEach((p) => add(`prog-${p.slug}`, p.title, order(p.programme_items)));
  const eds = progs.filter((p) => p.type === "edition").sort((a, b) => (a.spine_number ?? 0) - (b.spine_number ?? 0));
  add("collection", "The Cinematheque collection", eds.flatMap((e) => order(e.programme_items).slice(0, 1)));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const m = new URL(req.url).pathname.match(/stremio\/([^/]+)\/(.+)$/);
  if (!m || !(await tokenOk(m[1]).catch(() => false))) return json({ err: "Not found" }, 404);
  const path = decodeURIComponent(m[2]);
  try {
    const list = await shelves();
    if (path === "manifest.json") {
      return json({
        id: "community.cinematheque.programmes", version: "1.0.0", name: "The Cinematheque",
        description: "Your festivals, 31 Days challenges and collection from the Cinematheque, in programme order.",
        resources: ["catalog"], types: ["movie", "series"], idPrefixes: ["tt"],
        catalogs: (list.length ? list : [{ id: "collection-movie", name: "The Cinematheque collection", type: "movie" }]).map((c) => ({ id: c.id, type: c.type, name: c.name })),
      });
    }
    const c = path.match(/^catalog\/(movie|series)\/([^/]+?)(?:\/([^/]+))?\.json$/);
    if (!c) return json({ err: "Not found" }, 404);
    if (Number(new URLSearchParams(c[3] ?? "").get("skip") ?? 0) > 0) return json({ metas: [] });
    const shelf = list.find((s) => s.id === c[2] && s.type === c[1]);
    return json({
      metas: (shelf?.items ?? []).map(({ t, note }) => ({
        id: t.imdb_id, type: shelf!.type, name: t.title, poster: t.poster_url ?? undefined, posterShape: "poster",
        releaseInfo: t.year ? String(t.year) : undefined, description: note || t.overview || undefined,
      })),
      cacheMaxAge: 60,
    });
  } catch (e) {
    console.error(e);
    return json({ metas: [] });
  }
});
