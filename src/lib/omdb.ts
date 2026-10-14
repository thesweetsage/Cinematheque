import "server-only";

/* OMDb: IMDb, Rotten Tomatoes (films only) and Metacritic ratings by IMDb id. Free tier is 1,000 requests a day, so results are cached per title. */
export type Ratings = { imdb: number | null; rt: number | null; metacritic: number | null };

type Raw = { Response: "True" | "False"; imdbRating?: string; Metascore?: string; Ratings?: { Source: string; Value: string }[]; Error?: string };

export async function ratings(imdbId: string): Promise<Ratings> {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new Error("OMDB_API_KEY is not set");
  const res = await fetch(`https://www.omdbapi.com/?${new URLSearchParams({ apikey: key, i: imdbId })}`, { next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!res.ok) throw new Error(`OMDb failed: ${res.status}`);
  const d = (await res.json()) as Raw;
  if (d.Response === "False") return { imdb: null, rt: null, metacritic: null };
  const num = (v?: string) => (v && v !== "N/A" ? parseFloat(v) : null);
  const rt = d.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
  return { imdb: num(d.imdbRating), rt: num(rt?.replace("%", "")), metacritic: num(d.Metascore) };
}
