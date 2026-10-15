import { Suspense } from "react";
import Link from "next/link";
import { Aisle } from "@/components/Aisle";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { artOf, findTitle, getCatalog, shelf, type Catalog, type Rec } from "@/lib/catalog";
import { continueWatching } from "@/lib/plex/deck";
import s from "./front.module.css";

export default async function StoreFront() {
  const cat = await getCatalog();
  const onShelf = shelf(cat);
  const movies = onShelf.filter((t) => t.kind === "movie");
  const pool = movies.length >= 7 ? movies : onShelf;
  // Up to 14 different tapes face out, spread across the shelf.
  const faceOut = [...new Set(Array.from({ length: Math.min(14, pool.length) }, (_, i) => pool[Math.floor((i * pool.length) / Math.min(14, pool.length))]))];
  const pickRef = cat.picks[0];
  const pick = pickRef && findTitle(cat, pickRef.id);
  const pickArt = pick && artOf(cat, pick.id);

  const lane = (label: string, sub: string, items: Rec[]) => items.length > 0 && (
    <div className={s.lane}>
      <div className={s.laneHead}><span className={s.laneSign}>{label}</span><span className={s.laneSub}>{sub}</span></div>
      <div className={s.recs}>
        {items.map((r) => {
          const t = findTitle(cat, r.id);
          if (!t) return null;
          return (
            <Link key={r.id} href={`/title/${t.id}`} className={s.rec} aria-label={`${t.t}, ${t.y}. ${r.why}`}>
              <span className={s.recBox}><VhsBox title={t} art={artOf(cat, t.id)} width={170} /></span>
              <span className={s.card}>{r.why}<b>{r.who}</b></span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className={s.tagRow}><SampleTag catalog={cat} /></div>
      <Aisle catalog={cat} faceOut={faceOut} />
      <Suspense fallback={null}><ContinueWatching cat={cat} /></Suspense>
      {pick && (
        <section className={s.tonight}>
          <div className={s.crt}>
            <div className={s.screen} style={{ backgroundImage: pickArt?.backdrop ? `linear-gradient(90deg,#000 30%,rgba(0,0,0,.35)),url(${pickArt.backdrop})` : undefined }}>
              <span className={s.osdTl}>CH 03</span><span className={s.osdTr}>PLAY ▶</span>
              <div className={s.pick}>
                <span className={s.osd}>TONIGHT&apos;S PICK</span>
                <h2 className={s.pickTitle}>{pick.t}</h2>
                <span className={s.pickMeta}>{pick.y || ""}{pick.run ? ` · ${pick.run}` : ""}{pick.dir ? ` · ${pick.dir}` : ""}</span>
                <span className={s.why}>{pickRef.why}</span>
              </div>
            </div>
          </div>
          <div className={s.actions}>
            <Link className="btn primary" href={`/title/${pick.id}`}>Open the box</Link>
            <Link className="btn" href="/shelves">Browse the shelves</Link>
          </div>
        </section>
      )}
      <section className={s.section}>
        <h2 className="sec-title">Staff recommends</h2>
        {lane("POPULAR PICKS", "Well-loved titles you'll probably enjoy", cat.recs.pop)}
        {lane("DEEP CUTS", "Niche, older, foreign or overlooked", cat.recs.deep)}
        {!cat.recs.pop.length && !cat.recs.deep.length && (
          <p className={s.laneSub}>No staff cards yet. They&apos;re written from your watch history once it builds up.</p>
        )}
      </section>
    </>
  );
}

/* Plex's On Deck, read fresh every couple of minutes; streams in so a slow Plex never holds up the store front. */
async function ContinueWatching({ cat }: { cat: Catalog }) {
  const deck = await continueWatching();
  if (!deck.length) return null;
  return (
    <section className={s.section} aria-labelledby="cw">
      <h2 id="cw" className="sec-title">Continue watching</h2>
      <div className={s.deck}>
        {deck.map((d) => {
          const t = findTitle(cat, d.id);
          if (!t) return null;
          return (
            <Link key={d.id} href={`/title/${t.id}`} className={s.rec} aria-label={`${t.t}, ${d.label}`}>
              <span className={s.recBox}><VhsBox title={t} art={artOf(cat, t.id)} width={130} /></span>
              <span className={s.deckLabel}>{d.label}</span>
              <span className={s.bar} aria-hidden="true"><i style={{ width: `${Math.round(d.progress * 100)}%` }} /></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
