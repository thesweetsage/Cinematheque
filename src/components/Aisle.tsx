import Link from "next/link";
import { artFor, libraryTitles, type Title } from "@/lib/catalog";
import { VhsBox } from "./VhsBox";
import { AisleLights } from "./AisleLights";
import s from "./Aisle.module.css";

/*
 * The store front aisle: one CSS 3D room that never moves. Side shelves are scenery made from real poster colours;
 * the tapes you pick face out on the back wall. The lights come on once a day (AisleLights).
 */
export function Aisle({ faceOut }: { faceOut: Title[] }) {
  const lib = libraryTitles();
  const side = (offset: number) =>
    Array.from({ length: 6 }, (_, r) => (
      <div className={s.row} key={r}>
        {Array.from({ length: 24 }, (_, i) => {
          const t = lib[(i * 7 + r * 11 + offset) % lib.length];
          const a = artFor(t.id);
          const h = 78 + ((i * 13 + r * 7 + offset) % 18);
          return <span key={i} className={s.sp} style={{ "--c1": a.accent, "--c2": a.bg, "--h": `${h}%` } as React.CSSProperties} />;
        })}
      </div>
    ));
  const rows = [faceOut.slice(0, 7), faceOut.slice(7, 14)];
  return (
    <section className={s.scene} id="aisle" aria-label="Aisle one: new and staff picks">
      <h1 className="sr-only">The Cinematheque</h1>
      <div className={s.room}>
        <div className={`${s.plane} ${s.back}`}>
          <div className={s.sign} aria-hidden="true"><span className={s.tube} /><b>VIDEO</b><i>Cinematheque</i><span className={s.tube} /></div>
          <div className={s.faceout}>
            {rows.map((row, r) => (
              <div className={s.foRow} key={r}>
                {row.map((t, i) => (
                  <Link key={t.id} href={`/title/${t.id}`} className={s.slot} data-title={`${t.t} · ${t.y}${t.lib ? " · On Plex" : ""}`} aria-label={`${t.t}, ${t.y}`} data-autofocus={r === 0 && i === 3 ? true : undefined}>
                    <VhsBox title={t} art={artFor(t.id)} width={92} wear={i % 3 === 1 ? "loved" : "rented"} />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className={`${s.plane} ${s.left}`} aria-hidden="true">{side(0)}</div>
        <div className={`${s.plane} ${s.right}`} aria-hidden="true">{side(4)}</div>
        <div className={`${s.plane} ${s.floor}`} aria-hidden="true" />
        <div className={`${s.plane} ${s.ceil}`} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} className={s.panel} style={{ "--i": i } as React.CSSProperties} />)}</div>
      </div>
      <div className={s.haze} aria-hidden="true" />
      <div className={s.hud} aria-hidden="true"><span>▶ AISLE 1 · NEW &amp; STAFF PICKS</span><span className={s.hideS}>OPEN TILL LATE</span></div>
      <AisleLights />
    </section>
  );
}
