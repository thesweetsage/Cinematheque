import "server-only";
import { details, IMG, type TmdbKind } from "./tmdb";
import { ratings } from "./omdb";
import { logoInfo, spineColours } from "./spine";
import { db } from "./supabase";

/* Turns a TMDB id into a full `titles` row: metadata, ratings, poster/backdrop/logo URLs and generated spine colours. */
export type TitleRow = {
  slug: string; kind: "movie" | "series"; tmdb_id: number; imdb_id: string | null; title: string; year: number | null;
  runtime: number | null; seasons_count: number | null; genres: string[]; keywords: string[]; director_or_creator: string | null;
  cast_names: string[]; country: string | null; language: string | null; overview: string;
  poster_url: string | null; backdrop_url: string | null; logo_url: string | null;
  spine_bg: string | null; spine_accent: string | null; logo_dark: boolean; logo_ratio: number | null;
  rating_imdb: number | null; rating_rt: number | null; rating_metacritic: number | null; metadata_updated_at: string;
};

export const slugify = (title: string, year: number | null) =>
  `${title}-${year ?? ""}`.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const download = async (url: string) => Buffer.from(await (await fetch(url)).arrayBuffer());

export async function buildTitleRow(kind: TmdbKind, tmdbId: number): Promise<TitleRow> {
  const d = await details(kind, tmdbId);
  const poster = d.posterPath ? IMG("w342", d.posterPath) : null;
  const logo = d.logoPath ? IMG("w300", d.logoPath) : null;
  const [spine, logoMeta, rate] = await Promise.all([
    poster ? download(poster).then(spineColours) : null,
    logo ? download(logo).then(logoInfo) : null,
    d.imdbId && process.env.OMDB_API_KEY ? ratings(d.imdbId).catch(() => null) : null,
  ]);
  return {
    slug: slugify(d.title, d.year), kind: kind === "tv" ? "series" : "movie", tmdb_id: d.tmdbId, imdb_id: d.imdbId,
    title: d.title, year: d.year, runtime: d.runtime, seasons_count: d.seasons, genres: d.genres, keywords: d.keywords,
    director_or_creator: d.director, cast_names: d.cast, country: d.country, language: d.language, overview: d.overview,
    poster_url: poster, backdrop_url: d.backdropPath ? IMG("w780", d.backdropPath) : null, logo_url: logo,
    spine_bg: spine?.bg ?? null, spine_accent: spine?.accent ?? null, logo_dark: logoMeta?.dark ?? false, logo_ratio: logoMeta?.ratio ?? null,
    rating_imdb: rate?.imdb ?? null, rating_rt: kind === "movie" ? rate?.rt ?? null : null, rating_metacritic: rate?.metacritic ?? null,
    metadata_updated_at: new Date().toISOString(),
  };
}

/** Saves (or refreshes) a title and puts it on the shelves. Throws if the database isn't connected yet. */
export async function importTitle(kind: TmdbKind, tmdbId: number) {
  const client = db();
  if (!client) throw new Error("The database isn't connected yet.");
  const row = await buildTitleRow(kind, tmdbId);
  const { data, error } = await client.from("titles").upsert({ ...row, in_library: true }, { onConflict: "kind,tmdb_id" }).select("id, slug").single();
  if (error) throw new Error(error.message);
  return data as { id: string; slug: string };
}

/**
 * Saves a title without putting it on the shelves (a recommendation, a wishlist item), or returns it if it's already saved.
 * Slugs clash now and then (a remake in the same year): then the TMDB id goes on the end.
 */
export async function saveOffShelf(kind: TmdbKind, tmdbId: number) {
  const client = db();
  if (!client) throw new Error("The database isn't connected yet.");
  const { data: known } = await client.from("titles").select("id, slug").eq("kind", kind === "tv" ? "series" : "movie").eq("tmdb_id", tmdbId).maybeSingle();
  if (known) return known as { id: string; slug: string };
  const row = await buildTitleRow(kind, tmdbId);
  for (const slug of [row.slug, `${row.slug}-${tmdbId}`]) {
    const { data, error } = await client.from("titles").upsert({ ...row, slug }, { onConflict: "kind,tmdb_id" }).select("id, slug").single();
    if (!error) return data as { id: string; slug: string };
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error(`no free slug for ${row.slug}`);
}
