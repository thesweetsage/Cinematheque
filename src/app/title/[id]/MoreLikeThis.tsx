/* eslint-disable @next/next/no-img-element -- TMDB posters */
import Link from "next/link";
import { cacheLife } from "next/cache";
import { VhsBox } from "@/components/VhsBox";
import { WishTmdbButton } from "@/components/RecActions";
import { artOf, moreLikeThis, type Catalog, type Title } from "@/lib/catalog";
import { related, type Candidate } from "@/lib/tmdb";
import s from "./title.module.css";

/* TMDB's recommendations for this title, cached for a day. Empty without a TMDB key or on error. */
async function tmdbMore(kind: "movie" | "tv", id: number): Promise<Candidate[]> {
  "use cache";
  cacheLife("days");
  if (!process.env.TMDB_API_KEY) return [];
  return related(kind, id, "recommendations").catch(() => []);
}

/*
 * More like this: what TMDB recommends for the title. Tapes the store already has open their own box;
 * the rest show their poster with "+ Wishlist". Falls back to the same aisle / director from the shelves.
 */
export async function MoreLikeThis({ cat, t }: { cat: Catalog; t: Title }) {
  const kind = t.kind === "series" ? "tv" : "movie";
  const fromTmdb = t.tmdb ? (await tmdbMore(kind, t.tmdb)).slice(0, 12) : [];
  const byTmdb = new Map(cat.titles.filter((x) => x.tmdb && x.kind === t.kind).map((x) => [x.tmdb!, x]));
  const live = cat.source === "db";
  const items: ({ known: Title } | { c: Candidate })[] = fromTmdb.length
    ? fromTmdb.map((c) => (byTmdb.get(c.tmdbId) ? { known: byTmdb.get(c.tmdbId)! } : { c }))
    : moreLikeThis(cat, t).map((known) => ({ known }));
  if (!items.length) return null;
  return (
    <section className={s.more}>
      <h2 className="sec-title">More like this</h2>
      <div className={s.moreRow}>
        {items.map((it) => "known" in it ? (
          <Link key={it.known.id} href={`/title/${it.known.id}`} className={s.moreItem} aria-label={`${it.known.t}, ${it.known.y}`}>
            <span className={s.moreBox}><VhsBox title={it.known} art={artOf(cat, it.known.id)} width={120} wear={it.known.lib ? "rented" : "mint"} /></span>
          </Link>
        ) : (
          <div key={it.c.tmdbId} className={s.moreItem}>
            <div className={s.poster}>
              {it.c.poster ? <img src={it.c.poster} alt="" loading="lazy" decoding="async" /> : <span>{it.c.title}</span>}
            </div>
            <div className={s.posterCap}>{it.c.title}<small>{it.c.year ?? ""}</small></div>
            {live && <WishTmdbButton kind={it.c.kind} tmdbId={it.c.tmdbId} title={it.c.title} />}
          </div>
        ))}
      </div>
    </section>
  );
}
