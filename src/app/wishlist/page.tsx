import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { WishButton } from "@/components/RecActions";
import { artOf, findTitle, getCatalog } from "@/lib/catalog";
import s from "./wishlist.module.css";

export const metadata = { title: "Coming Soon · The Cinematheque" };

/*
 * The wishlist as the store's "Coming Soon" board: titles you want on your Plex.
 * The hourly Plex sync takes a title off the board as soon as it arrives in the library.
 */
export default async function Wishlist() {
  const cat = await getCatalog();
  const live = cat.source === "db";
  // The sample set has no wishlist: show the titles that aren't on the shelves, so the board can be seen.
  const ids = live ? cat.wish : cat.titles.filter((t) => !t.lib).map((t) => t.id);
  const titles = ids.map((id) => findTitle(cat, id)).filter((t) => !!t);
  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label">Wishlist · {titles.length} {titles.length === 1 ? "title" : "titles"}</div><h1 className={s.h1}>Coming soon</h1></div>
        <SampleTag catalog={cat} />
      </div>
      <p className={s.lede}>Titles you want on your Plex. Each one comes off the board by itself when the next Plex sync finds it in your library.</p>
      {!titles.length && (
        <p className={s.empty}>
          Nothing on order. Add titles from the <Link href="/" data-autofocus>staff cards</Link>, a title&apos;s <i>More like this</i>, or the <Link href="/search">Returns Slot</Link>.
        </p>
      )}
      <div className={s.board}>
        {titles.map((t, i) => (
          <div key={t.id} className={s.item}>
            <Link href={`/title/${t.id}`} className={s.slot} aria-label={`${t.t}, ${t.y}`} data-autofocus={i === 0 ? true : undefined}>
              <span className={s.boxWrap}><VhsBox title={t} art={artOf(cat, t.id)} width={150} wear="mint" /></span>
              <span className={s.tag}>{t.y || "TBA"}</span>
            </Link>
            <div className={s.cap}>{t.t}<small>{t.kind === "series" ? "Series" : "Film"}{t.dir ? ` · ${t.dir}` : ""}</small></div>
            {live && <WishButton slug={t.id} on title={t.t} />}
          </div>
        ))}
      </div>
    </>
  );
}
