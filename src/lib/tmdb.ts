import "server-only";

/* TMDB: search, details, credits, keywords, external ids and images for films and series. */
const BASE = "https://api.themoviedb.org/3";
export const IMG = (size: "w92" | "w185" | "w342" | "w500" | "w780" | "w300" | "original", path: string) => `https://image.tmdb.org/t/p/${size}${path}`;

export type TmdbKind = "movie" | "tv";
export type SearchHit = { tmdbId: number; kind: TmdbKind; title: string; year: number | null; poster: string | null; overview: string };

function key() {
  const k = process.env.TMDB_API_KEY;
  if (!k) throw new Error("TMDB_API_KEY is not set");
  return k;
}
async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `${BASE}${path}?${new URLSearchParams({ ...params, api_key: key() })}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type RawHit = { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path: string | null; overview: string; media_type?: string };
const toHit = (h: RawHit, kind: TmdbKind): SearchHit => ({
  tmdbId: h.id, kind, title: h.title ?? h.name ?? "", overview: h.overview,
  year: Number((h.release_date ?? h.first_air_date ?? "").slice(0, 4)) || null,
  poster: h.poster_path ? IMG("w185", h.poster_path) : null,
});

/** Films and series in one list, most relevant first. */
export async function search(query: string): Promise<SearchHit[]> {
  const { results } = await get<{ results: RawHit[] }>("/search/multi", { query, include_adult: "false" });
  return results.filter((r) => r.media_type === "movie" || r.media_type === "tv").slice(0, 20).map((r) => toHit(r, r.media_type as TmdbKind));
}

export type Details = {
  tmdbId: number; kind: TmdbKind; title: string; year: number | null; runtime: number | null; seasons: number | null;
  genres: string[]; keywords: string[]; director: string | null; cast: string[]; country: string | null; language: string | null;
  overview: string; imdbId: string | null; posterPath: string | null; backdropPath: string | null; logoPath: string | null;
};

type RawDetails = {
  id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; runtime?: number; number_of_seasons?: number;
  genres: { name: string }[]; overview: string; original_language: string; production_countries?: { name: string }[]; origin_country?: string[];
  poster_path: string | null; backdrop_path: string | null; imdb_id?: string; created_by?: { name: string }[];
  credits?: { cast: { name: string }[]; crew: { job: string; name: string }[] };
  keywords?: { keywords?: { name: string }[]; results?: { name: string }[] };
  external_ids?: { imdb_id?: string | null };
  images?: { logos: { file_path: string; iso_639_1: string | null }[] };
};

export async function details(kind: TmdbKind, id: number): Promise<Details> {
  const d = await get<RawDetails>(`/${kind}/${id}`, { append_to_response: "credits,keywords,external_ids,images", include_image_language: "en,null" });
  const logo = d.images?.logos.find((l) => l.file_path.endsWith(".png"));
  return {
    tmdbId: d.id, kind, title: d.title ?? d.name ?? "",
    year: Number((d.release_date ?? d.first_air_date ?? "").slice(0, 4)) || null,
    runtime: d.runtime ?? null, seasons: d.number_of_seasons ?? null,
    genres: d.genres.map((g) => g.name),
    keywords: (d.keywords?.keywords ?? d.keywords?.results ?? []).map((k) => k.name),
    director: kind === "movie" ? d.credits?.crew.find((c) => c.job === "Director")?.name ?? null : d.created_by?.map((c) => c.name).join(", ") || null,
    cast: (d.credits?.cast ?? []).slice(0, 5).map((c) => c.name),
    country: d.production_countries?.[0]?.name ?? d.origin_country?.[0] ?? null,
    language: d.original_language ?? null, overview: d.overview,
    imdbId: d.imdb_id ?? d.external_ids?.imdb_id ?? null,
    posterPath: d.poster_path, backdropPath: d.backdrop_path, logoPath: logo?.file_path ?? null,
  };
}

/** TMDB id for a title known only by its IMDb or TVDB id (from Plex). */
export async function findByExternalId(source: "imdb_id" | "tvdb_id", id: string, kind: TmdbKind): Promise<number | null> {
  const r = await get<{ movie_results: { id: number }[]; tv_results: { id: number }[] }>(`/find/${id}`, { external_source: source });
  return (kind === "movie" ? r.movie_results : r.tv_results)[0]?.id ?? null;
}

export type Review = { id: string; author: string; rating: number | null; date: string; text: string; url: string };

/** Up to 3 TMDB user reviews, highest rated first (English; TMDB has few in other languages). */
export async function reviews(kind: TmdbKind, id: number): Promise<Review[]> {
  type Raw = { id: string; author: string; author_details?: { rating: number | null }; created_at: string; content: string; url: string };
  const { results } = await get<{ results: Raw[] }>(`/${kind}/${id}/reviews`, { language: "en-US" });
  return results
    .map((r) => ({ id: r.id, author: r.author, rating: r.author_details?.rating ?? null, date: r.created_at.slice(0, 10), text: r.content.trim(), url: r.url }))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3);
}

export type TmdbSeason = { number: number; name: string; year: number | null; episodes: { number: number; name: string }[] };

/** A series' seasons with their episode names (specials last). */
export async function seasons(id: number): Promise<TmdbSeason[]> {
  type RawSeason = { season_number: number; name: string; air_date: string | null; episode_count: number };
  const show = await get<{ seasons: RawSeason[] }>(`/tv/${id}`);
  const list = await Promise.all(show.seasons.filter((s) => s.episode_count > 0).map(async (s) => {
    const d = await get<{ episodes: { episode_number: number; name: string }[] }>(`/tv/${id}/season/${s.season_number}`);
    return { number: s.season_number, name: s.name, year: Number(s.air_date?.slice(0, 4)) || null, episodes: d.episodes.map((e) => ({ number: e.episode_number, name: e.name })) };
  }));
  return [...list.filter((s) => s.number > 0), ...list.filter((s) => s.number === 0)];
}

/* ---------- Recommendations (phase 5) ---------- */

/** A title TMDB suggests, with what the lanes need to sort it: votes, average, language, age. */
export type Candidate = {
  tmdbId: number; kind: TmdbKind; title: string; year: number | null; votes: number; avg: number;
  language: string; genreIds: number[]; poster: string | null; overview: string;
};
type RawCandidate = RawHit & { vote_count: number; vote_average: number; original_language: string; genre_ids?: number[] };
const toCandidate = (r: RawCandidate, kind: TmdbKind): Candidate => ({
  ...toHit(r, kind), votes: r.vote_count ?? 0, avg: r.vote_average ?? 0, language: r.original_language ?? "", genreIds: r.genre_ids ?? [],
  poster: r.poster_path ? IMG("w342", r.poster_path) : null,
});

/** TMDB's "recommendations" or "similar" list for one title (first page, about 20). */
export async function related(kind: TmdbKind, id: number, list: "recommendations" | "similar"): Promise<Candidate[]> {
  const { results } = await get<{ results: RawCandidate[] }>(`/${kind}/${id}/${list}`, { language: "en-US" });
  return results.map((r) => toCandidate(r, kind));
}

/**
 * Discover: well-rated titles with any of these genres / keywords (TMDB ids), or all of `allGenres`,
 * optionally within years, in one original language, sorted by average (default) or by vote count.
 */
export async function discover(kind: TmdbKind, opts: {
  genres?: number[]; allGenres?: number[]; keywords?: number[]; minVotes: number; maxVotes?: number;
  before?: number; after?: number; language?: string; sort?: "vote_average.desc" | "vote_count.desc"; page?: number;
}): Promise<Candidate[]> {
  const p: Record<string, string> = { sort_by: opts.sort ?? "vote_average.desc", "vote_count.gte": String(opts.minVotes), include_adult: "false", page: String(opts.page ?? 1) };
  if (opts.maxVotes) p["vote_count.lte"] = String(opts.maxVotes);
  if (opts.genres?.length) p.with_genres = opts.genres.join("|");
  if (opts.allGenres?.length) p.with_genres = opts.allGenres.join(",");
  if (opts.keywords?.length) p.with_keywords = opts.keywords.join("|");
  if (opts.language) p.with_original_language = opts.language;
  if (kind === "movie") p["with_runtime.gte"] = "60"; // feature films only, no shorts
  const date = kind === "movie" ? "primary_release_date" : "first_air_date";
  if (opts.before) p[`${date}.lte`] = `${opts.before}-12-31`;
  if (opts.after) p[`${date}.gte`] = `${opts.after}-01-01`;
  const { results } = await get<{ results: RawCandidate[] }>(`/discover/${kind}`, p);
  return results.map((r) => toCandidate(r, kind));
}

/** TMDB's genre ids by name (films and series name some genres differently). */
export async function genreIds(kind: TmdbKind): Promise<Map<string, number>> {
  const { genres } = await get<{ genres: { id: number; name: string }[] }>(`/genre/${kind}/list`, { language: "en-US" });
  return new Map(genres.map((g) => [g.name, g.id]));
}

/** A keyword's TMDB id, by its exact name. */
export async function keywordId(name: string): Promise<number | null> {
  const { results } = await get<{ results: { id: number; name: string }[] }>("/search/keyword", { query: name });
  return results.find((k) => k.name.toLowerCase() === name.toLowerCase())?.id ?? null;
}

/** Looks a title up by name and year. Used to check Claude's suggestions: anything TMDB can't find is dropped. */
export async function lookupTitle(kind: TmdbKind, title: string, year: number | null): Promise<Candidate | null> {
  const p: Record<string, string> = { query: title, include_adult: "false" };
  if (year) p[kind === "movie" ? "year" : "first_air_date_year"] = String(year);
  const { results } = await get<{ results: RawCandidate[] }>(`/search/${kind}`, p);
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  const hit = results.map((r) => toCandidate(r, kind)).find((c) => norm(c.title) === norm(title) && (!year || !c.year || Math.abs(c.year - year) <= 1));
  return hit ?? null;
}

/* ---------- People (director retrospectives, phase 9) ---------- */

export type PersonHit = { id: number; name: string; department: string; knownFor: string[]; photo: string | null };

/** People by name, directors first. */
export async function searchPeople(query: string): Promise<PersonHit[]> {
  type Raw = { id: number; name: string; known_for_department: string; profile_path: string | null; known_for?: { title?: string; name?: string }[] };
  const { results } = await get<{ results: Raw[] }>("/search/person", { query, include_adult: "false" });
  return results.slice(0, 12).map((r) => ({
    id: r.id, name: r.name, department: r.known_for_department, photo: r.profile_path ? IMG("w185", r.profile_path) : null,
    knownFor: (r.known_for ?? []).map((k) => k.title ?? k.name ?? "").filter(Boolean).slice(0, 3),
  })).sort((a, b) => Number(b.department === "Directing") - Number(a.department === "Directing"));
}

export type Filmography = { id: number; name: string; imdbId: string | null; films: { tmdbId: number; title: string; date: string; votes: number }[] };

/** The feature films a person directed that have come out, oldest first. */
export async function directed(personId: number): Promise<Filmography> {
  type Raw = { id: number; name: string; external_ids?: { imdb_id?: string | null }; movie_credits?: { crew: { id: number; title: string; job: string; release_date?: string; vote_count: number }[] } };
  const p = await get<Raw>(`/person/${personId}`, { append_to_response: "movie_credits,external_ids" });
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<number>();
  const films = (p.movie_credits?.crew ?? [])
    .filter((c) => c.job === "Director" && c.release_date && c.release_date <= today && !seen.has(c.id) && seen.add(c.id))
    .map((c) => ({ tmdbId: c.id, title: c.title, date: c.release_date!, votes: c.vote_count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { id: p.id, name: p.name, imdbId: p.external_ids?.imdb_id ?? null, films };
}
