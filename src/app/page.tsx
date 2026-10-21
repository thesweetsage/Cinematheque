import Link from "next/link";
import { Aisle } from "@/components/Aisle";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { findEntry, loadCatalogue, picks, recs, shelf, type Catalogue, type Rec } from "@/lib/catalog";
import s from "./front.module.css";

export default async function StoreFront() {
  const c = await loadCatalogue();
  const onShelf = shelf(c);
  const movies = onShelf.filter((e) => e.title.kind === "movie");
  const pool = movies.length ? movies : onShelf;
  const faceOut = Array.from({ length: 14 }, (_, i) => pool[(i * 3) % pool.length]);
  // Sample: the staff's pick. Database: the newest tape until recommendations arrive (phase 5).
  const { title: pick, art: pickArt } = c.sample ? findEntry(c, picks[0].id)! : c.entries[0];
  const why = c.sample ? picks[0].why : "Newest tape on the shelf.";

  return (
    <>
      {c.sample && <div className={s.tagRow}><SampleTag /></div>}
      <Aisle faceOut={faceOut} side={onShelf} />
      <section className={s.tonight}>
        <div className={s.crt}>
          <div className={s.screen} style={{ backgroundImage: pickArt.backdrop ? `linear-gradient(90deg,#000 30%,rgba(0,0,0,.35)),url(${pickArt.backdrop})` : undefined }}>
            <span className={s.osdTl}>CH 03</span><span className={s.osdTr}>PLAY ▶</span>
            <div className={s.pick}>
              <span className={s.osd}>TONIGHT&apos;S PICK</span>
              <h2 className={s.pickTitle}>{pick.t}</h2>
              <span className={s.pickMeta}>{pick.y}{pick.run ? ` · ${pick.run}` : ""}{pick.dir ? ` · ${pick.dir}` : ""}</span>
              <span className={s.why}>{why}</span>
            </div>
          </div>
        </div>
        <div className={s.actions}>
          <Link className="btn primary" href={`/title/${pick.id}`}>Open the box</Link>
          <Link className="btn" href="/shelves">Browse the shelves</Link>
        </div>
      </section>
      {c.sample && (
        <section className={s.section}>
          <h2 className="sec-title">Staff recommends</h2>
          <Lane c={c} label="POPULAR PICKS" sub="Well-loved titles you'll probably enjoy" items={recs.pop} />
          <Lane c={c} label="DEEP CUTS" sub="Niche, older, foreign or overlooked" items={recs.deep} />
        </section>
      )}
    </>
  );
}

function Lane({ c, label, sub, items }: { c: Catalogue; label: string; sub: string; items: Rec[] }) {
  return (
    <div className={s.lane}>
      <div className={s.laneHead}><span className={s.laneSign}>{label}</span><span className={s.laneSub}>{sub}</span></div>
      <div className={s.recs}>
        {items.map((r) => {
          const { title: t, art } = findEntry(c, r.id)!;
          return (
            <Link key={r.id} href={`/title/${t.id}`} className={s.rec} aria-label={`${t.t}, ${t.y}. ${r.why}`}>
              <span className={s.recBox}><VhsBox title={t} art={art} width={170} /></span>
              <span className={s.card}>{r.why}<b>{r.who}</b></span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
