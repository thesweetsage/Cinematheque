import { brighten } from "./colour";
import type { Art, Kind, Title } from "./catalog";
import type { TitleRow } from "./importTitle";

/** A `titles` row as read back from the database (the importer's row plus the shelf flags). */
export type DbTitleRow = TitleRow & { on_plex?: boolean; in_library?: boolean };

/** Which aisle a title lives in, from its TMDB genres. */
export function aisleOf(kind: Kind, genres: string[], language: string | null) {
  const has = (g: string) => genres.includes(g);
  if (kind === "series") return "SERIES";
  if (has("Animation") && language === "ja") return "ANIME";
  if (has("Horror")) return "HORROR";
  if (has("Romance") && has("Comedy")) return "ROM-COM";
  if (has("Science Fiction")) return "SCI-FI";
  if (has("Fantasy")) return "FANTASY";
  if (has("Comedy")) return "COMEDY";
  return (genres[0] ?? "Drama").toUpperCase();
}

/* Maps a database / importer row to the shapes the VHS box and pages use. */
export function rowToTitle(r: DbTitleRow): { title: Title; art: Art } {
  return {
    title: {
      id: r.slug, t: r.title, y: r.year ?? 0, kind: r.kind, g: aisleOf(r.kind, r.genres, r.language), dir: r.director_or_creator ?? "",
      run: r.runtime ? `${Math.floor(r.runtime / 60)}h ${r.runtime % 60}m` : r.seasons_count ? `${r.seasons_count} season${r.seasons_count > 1 ? "s" : ""}` : undefined,
      lib: !!(r.on_plex || r.in_library), plex: !!r.on_plex,
      imdb: r.rating_imdb ?? undefined, rt: r.rating_rt ?? undefined, mc: r.rating_metacritic ?? undefined,
      cast: r.cast_names.join(", ") || undefined, ctry: r.country ?? undefined, syn: r.overview ?? "",
    },
    art: {
      poster: r.poster_url, logo: r.logo_url, backdrop: r.backdrop_url,
      bg: r.spine_bg ?? "#14112f", accent: brighten(r.spine_accent ?? "#b9b2ff"), logoDark: r.logo_dark, logoRatio: r.logo_ratio ?? 3,
    },
  };
}
