import { cacheLife } from "next/cache";
import { reviews, type TmdbKind } from "@/lib/tmdb";
import { ReviewCard } from "./ReviewCard";
import s from "./extras.module.css";

async function load(kind: TmdbKind, id: number) {
  "use cache";
  cacheLife("days");
  return reviews(kind, id).catch(() => []);
}

/* Customer comments: 2-3 TMDB user reviews, cut short until opened. */
export async function Reviews({ kind, tmdbId }: { kind: TmdbKind; tmdbId: number }) {
  const list = await load(kind, tmdbId);
  if (!list.length) return null;
  return (
    <section className={s.section} aria-labelledby="reviews-h">
      <h2 id="reviews-h" className="sec-title">Customer comments</h2>
      <p className={s.sub}>From TMDB members.</p>
      <div className={s.reviews}>{list.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
    </section>
  );
}
