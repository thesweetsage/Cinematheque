import Link from "next/link";
import { notFound } from "next/navigation";
import { BoxViewer } from "@/components/BoxViewer";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { allTitles, artFor, editions, facts, getTitle, moreLikeThis } from "@/lib/catalog";
import s from "./title.module.css";

export function generateStaticParams() { return allTitles().map((t) => ({ id: t.id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = getTitle((await params).id);
  return { title: t ? `${t.t} · The Cinematheque` : "Not found" };
}

/* The Box: one title, its VHS box you can turn, and the details printed on and around it. */
export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = getTitle(id);
  if (!t) notFound();
  const art = artFor(t.id);
  const fc = facts[t.id];
  const series = t.kind === "series";
  return (
    <>
      <div className={s.tagRow}><SampleTag /></div>
      <div className={s.layout} style={{ "--accent": art.accent } as React.CSSProperties}>
        <BoxViewer title={t} art={art} edition={editions[t.id]} />
        <div className={s.info}>
          <div className="osd-label">{series ? "Series" : "Film"} · {t.y}{t.run ? ` · ${t.run}` : ""}{t.lib ? " · On Plex" : ""}</div>
          <h1 className={s.h1}>{t.t}</h1>
          <dl className={s.credits}>
            <div><dt>{series ? "Created by" : "Director"}</dt><dd>{t.dir}</dd></div>
            {t.cast && <div><dt>Cast</dt><dd>{t.cast}</dd></div>}
            {t.ctry && <div><dt>Country</dt><dd>{t.ctry}</dd></div>}
          </dl>
          <div className={s.ratings}>
            {t.imdb && <div><span>IMDb</span><b>{t.imdb}</b></div>}
            {!series && t.rt && <div><span>Rotten T.</span><b>{t.rt}%</b></div>}
            {t.mc && <div><span>Metacritic</span><b>{t.mc}</b></div>}
            <div className={s.you}><span>Your stars</span><b>{t.my ? "★".repeat(t.my) + "☆".repeat(5 - t.my) : "Not rated"}</b></div>
          </div>
          <p className={s.syn}>{t.syn}</p>
          <div className={s.play}>
            {t.lib ? <button className="btn primary">Play on Plex ▶</button> : <button className="btn">+ Add to wishlist</button>}
            <button className="btn">Open in Stremio</button>
          </div>
          {fc && (
            <section className={s.facts}>
              <h2 className="sec-title">Did you know?</h2>
              <div className={s.factGrid}>
                {fc.map((f, i) => <article key={i} className={s.fact}><span>{String(i + 1).padStart(2, "0")} · {f.k}</span><p>{f.x}</p></article>)}
              </div>
            </section>
          )}
        </div>
      </div>
      <section className={s.more}>
        <h2 className="sec-title">More like this</h2>
        <div className={s.moreRow}>
          {moreLikeThis(t).map((x) => (
            <Link key={x.id} href={`/title/${x.id}`} className={s.moreItem} aria-label={`${x.t}, ${x.y}`}>
              <span className={s.moreBox}><VhsBox title={x} art={artFor(x.id)} width={120} /></span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
