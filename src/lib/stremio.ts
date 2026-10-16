import "server-only";
import { timingSafeEqual, createHmac } from "node:crypto";
// Only the builder: the rest of the SDK is an Express server, and Next serves the add-on itself.
import addonBuilder from "stremio-addon-sdk/src/builder";
import { artOf, findTitle, getCatalog, type Title } from "./catalog";
import { getProgrammes, type Programme } from "./programmes";

/*
 * The Cinematheque as a Stremio add-on: every live festival and 31 Days becomes a catalogue in programme order,
 * plus the collection of editions. Catalogues only (IMDb ids); Stremio's own Cinemeta fills in the details and
 * your stream add-ons do the playing.
 *
 * Stremio can't sign in, so the add-on's address carries a token derived from the server secret:
 * /api/stremio/<token>/manifest.json. Changing SESSION_SECRET changes the address.
 */

/** The token in the add-on's address. "open" when there's no database and so nothing private to protect. */
export function addonToken() {
  const raw = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!raw) return "open";
  return createHmac("sha256", raw).update("cinematheque stremio add-on v1").digest("base64url").slice(0, 32);
}

export function tokenOk(token: string) {
  const want = Buffer.from(addonToken()), got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

type Kind = "movie" | "series";
type Meta = { id: string; type: Kind; name: string; poster?: string; posterShape: "poster"; releaseInfo?: string; description?: string };
type Shelf = { id: string; name: string; type: Kind; items: { t: Title; note?: string }[] };

const order = (p: Programme) => [...p.items].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.position - b.position);

/** The catalogues as they stand now: one per live programme and kind, then the collection. */
async function shelves(): Promise<Shelf[]> {
  const [cat, progs] = await Promise.all([getCatalog(), getProgrammes()]);
  const today = progs.today;
  const out: Shelf[] = [];
  const add = (id: string, name: string, items: { id: string; note?: string }[]) => {
    const found: Shelf["items"] = [];
    for (const it of items) { const t = findTitle(cat, it.id); if (t?.tt) found.push({ t, note: it.note }); }
    for (const type of ["movie", "series"] as const) {
      const mine = found.filter((x) => x.t.kind === type);
      if (mine.length) out.push({ id: `${id}-${type}`, name, type, items: mine });
    }
  };
  const live = progs.list.filter((p) => (p.type === "festival" || p.type === "days31") && p.status === "live" && (!p.end || p.end >= today))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  for (const p of live) add(`prog-${p.slug}`, p.title, order(p).map((it) => ({ id: it.id, note: it.note })));
  const editions = progs.list.filter((p) => p.type === "edition" && p.status !== "draft").sort((a, b) => (a.spine ?? 0) - (b.spine ?? 0));
  add("collection", "The Cinematheque collection", editions.flatMap((e) => (e.items[0] ? [{ id: e.items[0].id }] : [])));
  return out;
}

/** Builds the add-on for this request. `origin` makes the store's own artwork paths absolute. */
export async function buildAddon(origin: string) {
  const list = await shelves();
  const cat = await getCatalog();
  const abs = (u: string | null) => (!u ? undefined : u.startsWith("http") ? u : `${origin}${u}`);
  const builder = new addonBuilder({
    id: "community.cinematheque.programmes",
    version: "1.0.0",
    name: "The Cinematheque",
    description: "Your festivals, 31 Days challenges and collection from the Cinematheque, in programme order.",
    logo: `${origin}/favicon.ico`,
    resources: ["catalog"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    // Stremio wants at least one catalogue; an empty wall still lists the collection.
    catalogs: (list.length ? list : [{ id: "collection-movie", name: "The Cinematheque collection", type: "movie" as Kind, items: [] }])
      .map((c) => ({ id: c.id, type: c.type, name: c.name })),
  });
  builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (Number(extra?.skip ?? 0) > 0) return { metas: [] };
    const shelf = list.find((c) => c.id === id && c.type === type);
    const metas: Meta[] = (shelf?.items ?? []).map(({ t, note }) => ({
      id: t.tt!, type: shelf!.type, name: t.t, poster: abs(artOf(cat, t.id).poster), posterShape: "poster",
      releaseInfo: t.y ? String(t.y) : undefined, description: note || t.syn || undefined,
    }));
    return { metas, cacheMaxAge: 60 };
  });
  return builder.getInterface();
}
