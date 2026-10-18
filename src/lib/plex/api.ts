import "server-only";

/*
 * Plex: plex.tv for signing in with a code (plex.tv/link) and finding your servers, then the server's own API
 * (http://<server>:32400) for the library, episodes and On Deck. Everything asks for JSON.
 */

const PLEX_TV = process.env.PLEX_TV_URL || "https://plex.tv"; // overridable for local testing only
export const PRODUCT = "The Cinematheque";

const plexHeaders = (clientId: string, token?: string): Record<string, string> => ({
  Accept: "application/json",
  "X-Plex-Product": PRODUCT,
  "X-Plex-Client-Identifier": clientId,
  ...(token ? { "X-Plex-Token": token } : {}),
});

async function json<T>(url: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(init.timeout ?? 20_000) });
  if (res.status === 401) throw new Error("Plex refused the token (401). Connect Plex again.");
  if (!res.ok) throw new Error(`Plex answered ${res.status} for ${new URL(url).pathname}`);
  return res.json() as Promise<T>;
}

/* ---------- plex.tv: sign in with a code ---------- */

export type Pin = { id: number; code: string; expiresAt: string; authToken: string | null };

/** A 4-character code to enter at plex.tv/link. */
export const createPin = (clientId: string) => json<Pin>(`${PLEX_TV}/api/v2/pins?strong=false`, { method: "POST", headers: plexHeaders(clientId) });
export const checkPin = (clientId: string, id: number) => json<Pin>(`${PLEX_TV}/api/v2/pins/${id}`, { headers: plexHeaders(clientId) });

type Resource = {
  name: string; provides: string; clientIdentifier: string; accessToken?: string; owned: boolean;
  connections: { protocol: string; address: string; port: number; uri: string; local: boolean; relay: boolean }[];
};
export type ServerChoice = { name: string; machineId: string; token: string; owned: boolean; urls: string[] };

/** The Plex Media Servers this account can reach, with the addresses to try (home network first). */
export async function listServers(clientId: string, accountToken: string): Promise<ServerChoice[]> {
  const all = await json<Resource[]>(`${PLEX_TV}/api/v2/resources?includeHttps=1&includeRelay=0`, { headers: plexHeaders(clientId, accountToken) });
  return all
    .filter((r) => r.provides.split(",").includes("server"))
    .map((r) => {
      const conns = [...r.connections].filter((c) => !c.relay).sort((a, b) => Number(b.local) - Number(a.local));
      // Each connection is offered as its plex.direct HTTPS address and as plain http to the same IP (some routers block plex.direct).
      const urls = conns.flatMap((c) => [c.uri, ...(c.local ? [`http://${c.address}:${c.port}`] : [])]);
      return { name: r.name, machineId: r.clientIdentifier, token: r.accessToken ?? accountToken, owned: r.owned, urls: [...new Set(urls)] };
    });
}

/* ---------- The server ---------- */

export type Server = { url: string; token: string };

const get = <T>(s: Server, path: string, params: Record<string, string> = {}, timeout?: number) => {
  const u = new URL(path, s.url.endsWith("/") ? s.url : s.url + "/");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return json<{ MediaContainer: T }>(u.toString(), { headers: { Accept: "application/json", "X-Plex-Token": s.token }, timeout }).then((r) => r.MediaContainer);
};

/** The server's machine identifier, or null if it can't be reached at this address. */
export async function identity(s: Server, timeout = 4000): Promise<string | null> {
  try { return (await get<{ machineIdentifier: string }>(s, "identity", {}, timeout)).machineIdentifier; }
  catch { return null; }
}

/** The first address that answers from where the app runs. */
export async function firstReachable(urls: string[], token: string) {
  for (const url of urls) if (await identity({ url, token })) return url;
  return null;
}

export type Section = { key: string; type: "movie" | "show" | string; title: string };
export const sections = async (s: Server) => ((await get<{ Directory?: Section[] }>(s, "library/sections")).Directory ?? []);

export type Item = {
  ratingKey: string; type: string; title: string; year?: number; guid?: string; Guid?: { id: string }[];
  lastViewedAt?: number; viewCount?: number; userRating?: number; duration?: number; viewOffset?: number;
  // Episodes
  grandparentRatingKey?: string; grandparentTitle?: string; parentIndex?: number; index?: number;
};

/** Every item of one type in a section (1 = film, 2 = show, 4 = episode), 500 at a time. */
export async function sectionItems(s: Server, sectionKey: string, type: 1 | 2 | 4): Promise<Item[]> {
  const out: Item[] = [];
  for (let start = 0; ; start += 500) {
    const page = await get<{ Metadata?: Item[]; totalSize?: number; size: number }>(s, `library/sections/${sectionKey}/all`, {
      type: String(type), includeGuids: "1", "X-Plex-Container-Start": String(start), "X-Plex-Container-Size": "500",
    }, 60_000);
    out.push(...(page.Metadata ?? []));
    if (!page.Metadata?.length || page.Metadata.length < 500 || (page.totalSize && out.length >= page.totalSize)) return out;
  }
}

/** Films in progress and the next episode of shows you're watching. */
export const onDeck = async (s: Server) => ((await get<{ Metadata?: Item[] }>(s, "library/onDeck", {}, 8000)).Metadata ?? []);

/** imdb / tmdb / tvdb ids from an item, from the new agents' Guid list or an old agent's guid string. */
export function externalIds(item: Item) {
  const ids: { imdb?: string; tmdb?: number; tvdb?: number } = {};
  const all = [...(item.Guid ?? []).map((g) => g.id), item.guid ?? ""];
  for (const g of all) {
    const m = g.match(/^(?:com\.plexapp\.agents\.)?(imdb|tmdb|themoviedb|tvdb|thetvdb):\/\/([^?/]+)/);
    if (!m) continue;
    const [, src, val] = m;
    if (src === "imdb" && /^tt\d+$/.test(val)) ids.imdb ??= val;
    else if ((src === "tmdb" || src === "themoviedb") && /^\d+$/.test(val)) ids.tmdb ??= Number(val);
    else if ((src === "tvdb" || src === "thetvdb") && /^\d+$/.test(val)) ids.tvdb ??= Number(val);
  }
  return ids;
}

/* ---------- Writing to the server (collections) ---------- */

/** Any request to the server; answers its MediaContainer, or null when the reply is empty. */
export async function plexRequest<T>(s: Server, method: "GET" | "POST" | "PUT" | "DELETE", path: string, params: Record<string, string> = {}): Promise<T | null> {
  const u = new URL(path, s.url.endsWith("/") ? s.url : s.url + "/");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { method, headers: { Accept: "application/json", "X-Plex-Token": s.token }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (res.status === 401) throw new Error("Plex refused the token (401). Connect Plex again.");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Plex answered ${res.status} for ${method} ${u.pathname}`);
  const text = await res.text();
  return text ? ((JSON.parse(text) as { MediaContainer: T }).MediaContainer ?? null) : null;
}
