import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoxViewer } from "@/components/BoxViewer";
import { PlayOnPlex } from "@/components/PlayOnPlex";
import { SampleTag } from "@/components/SampleTag";
import { artOf, findTitle, getCatalog, type Catalog, type Title } from "@/lib/catalog";
import { titleExtras } from "@/lib/titleExtras";
import { WishButton } from "@/components/RecActions";
import { Booklet } from "./Booklet";
import { MoreLikeThis } from "./MoreLikeThis";
import { InductButton } from "../../programmes/client";
import { editionOf, getProgrammes, spineLabel } from "@/lib/programmes";
import { Reviews } from "./Reviews";
import { Seasons } from "./Seasons";
import s from "./title.module.css";

export async function generateStaticParams() { return (await getCatalog()).titles.map((t) => ({ id: t.id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = findTitle(await getCatalog(), (await params).id);
  return { title: t ? `${t.t} · The Cinematheque` : "Not found" };
}

/* The Box: one title, its VHS box you can turn, and the details printed on and around it. */
export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = await getCatalog();
  const t = findTitle(cat, id);
  if (!t) notFound();
  const art = artOf(cat, t.id);
  const series = t.kind === "series";
  return (
    <>
      <div className={s.tagRow}><SampleTag catalog={cat} /></div>
      <div className={s.layout} style={{ "--accent": art.accent } as React.CSSProperties}>
        <BoxViewer title={t} art={art} edition={cat.editions[t.id]} />
        <div className={s.info}>
          <div className="osd-label">{series ? "Series" : "Film"} · {t.y || "Year unknown"}{t.run ? ` · ${t.run}` : ""}{t.plex ? " · On Plex" : ""}</div>
          <h1 className={s.h1}>{t.t}</h1>
          <dl className={s.credits}>
            {t.dir && <div><dt>{series ? "Created by" : "Director"}</dt><dd>{t.dir}</dd></div>}
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
            {t.plex && t.plexKey && cat.plexServer ? <PlayOnPlex machineId={cat.plexServer} ratingKey={t.plexKey} series={series} />
              : t.plex ? <button className="btn primary">Play on Plex ▶</button>
              : cat.source === "db" ? <WishButton slug={t.id} on={cat.wish.includes(t.id)} title={t.t} big />
              : <button className="btn">+ Add to wishlist</button>}
            <button className="btn">Open in Stremio</button>
          </div>
          <Suspense fallback={null}><Collection cat={cat} t={t} /></Suspense>
        </div>
      </div>
      <Suspense fallback={null}><TitleExtras cat={cat} t={t} /></Suspense>
      {t.tmdb && <Suspense fallback={null}><Reviews kind={series ? "tv" : "movie"} tmdbId={t.tmdb} /></Suspense>}
      <Suspense fallback={null}><MoreLikeThis cat={cat} t={t} /></Suspense>
    </>
  );
}

/* The collection: this title's edition number, or the button that inducts it. */
async function Collection({ cat, t }: { cat: Catalog; t: Title }) {
  const progs = await getProgrammes();
  const ed = editionOf(progs, t.id);
  if (ed) return <p className={s.edition}><Link href={`/programmes/${ed.slug}`}>★ {spineLabel(ed.spine)} in the collection: read the essay</Link></p>;
  return cat.source === "db" && progs.source === "db" ? <div className={s.play}><InductButton titleSlug={t.id} title={t.t} /></div> : null;
}

/* Seasons (series) and the booklet: per-title reads that stream in after the box. */
async function TitleExtras({ cat, t }: { cat: Catalog; t: Title }) {
  const live = cat.source === "db";
  const extras = live ? await titleExtras(t.id) : null;
  return (
    <>
      {t.kind === "series" && t.tmdb && <Seasons tmdbId={t.tmdb} local={extras?.episodes ?? []} />}
      <Booklet slug={t.id} title={t.t} notes={extras?.notes ?? null} sampleCards={cat.facts[t.id]?.cards} live={live && !!extras} canWrite={!!extras?.canWrite} />
    </>
  );
}
