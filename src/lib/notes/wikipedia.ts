import "server-only";

/*
 * Wikipedia is the only source for fact cards and liner notes. Wikidata finds the article by IMDb id (property P345),
 * then the article's plain text comes from the Wikipedia API. Wikimedia asks every client to identify itself.
 */
const WIKIDATA = process.env.WIKIDATA_URL || "https://www.wikidata.org"; // overridable for local testing only
const WIKIPEDIA = process.env.WIKIPEDIA_URL || "https://en.wikipedia.org";
const HEADERS = { "User-Agent": "TheCinematheque/0.1 (personal home video store; one user)", Accept: "application/json" };

export type Article = { title: string; url: string; revision: number; text: string };

async function api<T>(base: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${base}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`, {
    headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
  return res.json() as Promise<T>;
}

/** The English Wikipedia article for an IMDb id, or null when there isn't one. */
export async function articleFor(imdbId: string): Promise<Article | null> {
  const found = await api<{ query: { search: { title: string }[] } }>(WIKIDATA, { action: "query", list: "search", srsearch: `haswbstatement:P345=${imdbId}`, srlimit: "1" });
  const qid = found.query.search[0]?.title;
  if (!qid) return null;
  const entity = await api<{ entities: Record<string, { sitelinks?: { enwiki?: { title: string } } }> }>(WIKIDATA, { action: "wbgetentities", ids: qid, props: "sitelinks", sitefilter: "enwiki" });
  const title = entity.entities[qid]?.sitelinks?.enwiki?.title;
  if (!title) return null;
  const page = await api<{ query: { pages: { title: string; missing?: boolean; extract?: string; fullurl?: string; lastrevid?: number }[] } }>(WIKIPEDIA, {
    action: "query", prop: "extracts|info", explaintext: "1", exsectionformat: "wiki", inprop: "url", redirects: "1", titles: title,
  });
  const p = page.query.pages[0];
  if (!p || p.missing || !p.extract) return null;
  return { title: p.title, url: p.fullurl ?? `${WIKIPEDIA}/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`, revision: p.lastrevid ?? 0, text: p.extract };
}
