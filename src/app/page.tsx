import { Suspense } from "react";
import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { StoreShelf } from "@/components/StoreShelf";
import { WalkIn, WalkInAgain } from "@/components/WalkIn";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { RecThumbs, WishButton } from "@/components/RecActions";
import { artOf, findTitle, getCatalog, shelf, type Catalog, type Rec } from "@/lib/catalog";
import { continueWatching } from "@/lib/plex/deck";
import { behind, epCode, getProgrammes, isRunning } from "@/lib/programmes";
import s from "./front.module.css";

export default async function StoreFront() {
  const cat = await getCatalog();
  const onShelf = shelf(cat);
  const movies = onShelf.filter((t) => t.kind === "movie");
  const pool = movies.length >= 7 ? movies : onShelf;
  // Up to 12 different tapes face out, spread across the shelf.
  const n = Math.min(12, pool.length);
  const faceOut = [...new Set(Array.from({ length: n }, (_, i) => pool[Math.floor((i * pool.length) / n)]))];
  const pickRef = cat.picks[0];
  const pick = pickRef && findTitle(cat, pickRef.id);
  const pickArt = pick && artOf(cat, pick.id);
  const store = storeFootage();

  const live = cat.source === "db";
  const wish = new Set(cat.wish);
  const lane = (label: string, sub: string, items: Rec[], tone?: string) => items.length > 0 && (
    <div className={s.lane} style={tone ? ({ "--tone": tone } as React.CSSProperties) : undefined}>
      <div className={s.laneHead}><span className={s.laneSign}>{label}</span><span className={s.laneSub}>{sub}</span></div>
      <div className={s.recs}>
        {items.map((r) => {
          const t = findTitle(cat, r.id);
          if (!t) return null;
          return (
            <div key={r.id} className={s.recCell}>
              <Link href={`/title/${t.id}`} className={s.rec} aria-label={`${t.t}, ${t.y}. ${r.why}`}>
                <span className={s.recBox}><VhsBox title={t} art={artOf(cat, t.id)} width={170} /></span>
                <span className={s.card}>{r.why}<b>{r.who}</b></span>
              </Link>
              {live && (r.recId || !t.plex) && (
                <div className={s.recActions}>
                  {r.recId && <RecThumbs recId={r.recId} title={t.t} />}
                  {!t.plex && !t.lib && <WishButton slug={t.id} on={wish.has(t.id)} title={t.t} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className={s.tagRow}><SampleTag catalog={cat} /></div>
      {store.video && <WalkIn src={store.video} poster={store.still} />}
      <StoreShelf catalog={cat} tapes={faceOut} backdrop={store.still ?? pickArt?.backdrop ?? null} />
      {store.video && <div className={s.again}><WalkInAgain /></div>}
      <Suspense fallback={null}><Overdue /></Suspense>
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
        {lane("POPULAR PICKS", "Well-loved titles you'll probably enjoy", cat.recs.pop, "var(--yellow)")}
        {lane("DEEP CUTS", "Niche, older, foreign or overlooked", cat.recs.deep, "var(--mag)")}
        {cat.recs.because.map((b) => {
          const seed = findTitle(cat, b.seed);
          return seed && <div key={b.seed}>{lane("BECAUSE YOU WATCHED", seed.t, b.items, "var(--cyan)")}</div>;
        })}
        {lane("ON YOUR SHELF, UNWATCHED", "Tapes you own and never played", cat.recs.shelf, "var(--orange)")}
        {!cat.recs.pop.length && !cat.recs.deep.length && (
          <p className={s.laneSub}>No staff cards yet. They&apos;re written every night from your Plex watch history once it builds up.</p>
        )}
      </section>
    </>
  );
}

/* The nudge: a marathon that's fallen behind gets an OVERDUE slip on the counter, with the next episode due. */
async function Overdue() {
  const progs = await getProgrammes();
  const late = progs.list.filter((p) => p.type === "marathon" && isRunning(p, progs.today)).map((p) => ({ p, n: behind(p, progs.today) })).filter((x) => x.n > 0);
  if (!late.length) return null;
  return (
    <section className={s.overdue} aria-label="Overdue">
      {late.map(({ p, n }) => {
        const next = [...p.items].filter((i) => !i.done).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.position - b.position)[0];
        return (
          <Link key={p.slug} href={`/programmes/${p.slug}`} className={s.slip}>
            <span className={s.slipStamp}>Overdue</span>
            <span className={s.slipText}><b>{p.title}</b> {n} episode{n === 1 ? "" : "s"} behind{next?.ep ? `. Next up: ${epCode(next.ep)}${next.ep.name ? ` · ${next.ep.name}` : ""}` : ""}</span>
            <span className={s.slipGo}>Open the card ▶</span>
          </Link>
        );
      })}
    </section>
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

/*
 * The walk-in footage, if it's been made: public/store/walk-in.mp4 (entering the store, ending face-on to the shelf)
 * and public/store/shelf.jpg (that end frame, used behind the live shelf).
 */
function storeFootage() {
  const has = (f: string) => existsSync(path.join(process.cwd(), "public", "store", f));
  return { video: has("walk-in.mp4") ? "/store/walk-in.mp4" : null, still: has("shelf.jpg") ? "/store/shelf.jpg" : null };
}
