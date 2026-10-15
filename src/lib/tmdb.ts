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
