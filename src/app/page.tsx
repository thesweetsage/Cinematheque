import Link from "next/link";
import { Aisle } from "@/components/Aisle";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { allTitles, artFor, getTitle, picks, recs, type Rec } from "@/lib/catalog";
import s from "./front.module.css";

export default function StoreFront() {
  const movies = allTitles().filter((t) => t.lib && t.kind === "movie");
  const faceOut = Array.from({ length: 14 }, (_, i) => movies[(i * 3) % movies.length]);
  const pick = getTitle(picks[0].id)!;
  const pickArt = artFor(pick.id);

  const lane = (label: string, sub: string, items: Rec[]) => (
    <div className={s.lane}>
      <div className={s.laneHead}><span className={s.laneSign}>{label}</span><span className={s.laneSub}>{sub}</span></div>
      <div className={s.recs}>
        {items.map((r) => {
          const t = getTitle(r.id)!;
          return (
            <Link key={r.id} href={`/title/${t.id}`} className={s.rec} aria-label={`${t.t}, ${t.y}. ${r.why}`}>
              <span className={s.recBox}><VhsBox title={t} art={artFor(t.id)} width={170} /></span>
              <span className={s.card}>{r.why}<b>{r.who}</b></span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className={s.tagRow}><SampleTag /></div>
      <Aisle faceOut={faceOut} />
      <section className={s.tonight}>
        <div className={s.crt}>
          <div className={s.screen} style={{ backgroundImage: pickArt.backdrop ? `linear-gradient(90deg,#000 30%,rgba(0,0,0,.35)),url(${pickArt.backdrop})` : undefined }}>
            <span className={s.osdTl}>CH 03</span><span className={s.osdTr}>PLAY ▶</span>
            <div className={s.pick}>
              <span className={s.osd}>TONIGHT&apos;S PICK</span>
              <h2 className={s.pickTitle}>{pick.t}</h2>
              <span className={s.pickMeta}>{pick.y}{pick.run ? ` · ${pick.run}` : ""} · {pick.dir}</span>
              <span className={s.why}>{picks[0].why}</span>
            </div>
          </div>
        </div>
        <div className={s.actions}>
          <Link className="btn primary" href={`/title/${pick.id}`}>Open the box</Link>
          <Link className="btn" href="/shelves">Browse the shelves</Link>
        </div>
      </section>
      <section className={s.section}>
        <h2 className="sec-title">Staff recommends</h2>
        {lane("POPULAR PICKS", "Well-loved titles you'll probably enjoy", recs.pop)}
        {lane("DEEP CUTS", "Niche, older, foreign or overlooked", recs.deep)}
      </section>
    </>
  );
}
