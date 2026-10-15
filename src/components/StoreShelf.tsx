/* eslint-disable @next/next/no-img-element -- one static backdrop still */
import Link from "next/link";
import { artOf, type Catalog, type Title } from "@/lib/catalog";
import { VhsBox } from "./VhsBox";
import { ShelfLabel } from "./ShelfLabel";
import s from "./StoreShelf.module.css";

/*
 * The store front: the store behind (a photographic still: the walk-in's end frame, or a film still until there is one)
 * and one wall shelf in front with big tapes facing out, spines on the left. Nothing moves until a tape is chosen.
 */
export function StoreShelf({ catalog, tapes, backdrop }: { catalog: Catalog; tapes: Title[]; backdrop: string | null }) {
  const rows = [tapes.slice(0, 6), tapes.slice(6, 12)].filter((r) => r.length);
  return (
    <section className={s.scene} aria-label="The new releases wall">
      <h1 className="sr-only">The Cinematheque</h1>
      <div className={s.room} aria-hidden="true">
        {backdrop && <img className={s.photo} src={backdrop} alt="" />}
      </div>
      <div className={s.unit}>
        <div className={s.signRow} aria-hidden="true"><span className={s.sign}>New on the shelf</span></div>
        {rows.map((row, r) => (
          <div key={r} className={s.tier}>
            <div className={s.row}>
              {row.map((t, i) => (
                <Link key={t.id} href={`/title/${t.id}`} className={s.slot} data-title={`${t.t}${t.y ? ` · ${t.y}` : ""}${t.plex ? " · On Plex" : ""}`} aria-label={`${t.t}${t.y ? `, ${t.y}` : ""}`} data-autofocus={r === 0 && i === 0 ? true : undefined}>
                  <VhsBox title={t} art={artOf(catalog, t.id)} width={200} wear={i % 3 === 1 ? "loved" : "rented"} />
                </Link>
              ))}
            </div>
            <div className={s.board} aria-hidden="true" />
          </div>
        ))}
        <ShelfLabel />
      </div>
    </section>
  );
}
