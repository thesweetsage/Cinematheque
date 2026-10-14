import { brighten } from "./colour";
import type { Art, Title } from "./catalog";
import type { TitleRow } from "./importTitle";

/* Maps a database / importer row to the shapes the VHS box and pages use. */
export function rowToTitle(r: TitleRow): { title: Title; art: Art } {
  return {
    title: {
      id: r.slug, t: r.title, y: r.year ?? 0, kind: r.kind, g: (r.genres[0] ?? "").toUpperCase(), dir: r.director_or_creator ?? "",
      run: r.runtime ? `${Math.floor(r.runtime / 60)}h ${r.runtime % 60}m` : r.seasons_count ? `${r.seasons_count} season${r.seasons_count > 1 ? "s" : ""}` : undefined,
      lib: false, imdb: r.rating_imdb ?? undefined, rt: r.rating_rt ?? undefined, mc: r.rating_metacritic ?? undefined,
      cast: r.cast_names.join(", ") || undefined, ctry: r.country ?? undefined, syn: r.overview,
    },
    art: {
      poster: r.poster_url, logo: r.logo_url, backdrop: r.backdrop_url,
      bg: r.spine_bg ?? "#14112f", accent: brighten(r.spine_accent ?? "#b9b2ff"), logoDark: r.logo_dark, logoRatio: r.logo_ratio ?? 3,
    },
  };
}
