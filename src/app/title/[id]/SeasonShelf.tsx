"use client";
import { useState } from "react";
import s from "./extras.module.css";

export type ShelfSeason = { number: number; name: string; year: number | null; episodes: { number: number; name: string; onPlex: boolean; watched: boolean }[] };

/* A season picker (one button per season) and that season's episodes with ON PLEX and watched ticks. */
export function SeasonShelf({ seasons }: { seasons: ShelfSeason[] }) {
  const firstUnfinished = seasons.find((x) => x.number > 0 && x.episodes.some((e) => !e.watched)) ?? seasons[0];
  const [pick, setPick] = useState(firstUnfinished.number);
  const cur = seasons.find((x) => x.number === pick) ?? seasons[0];
  // Specials don't count towards finishing a series.
  const all = seasons.filter((x) => x.number > 0).flatMap((x) => x.episodes), done = all.filter((e) => e.watched).length;
  const finished = all.length > 0 && done === all.length;
  const label = (x: ShelfSeason) => (x.number === 0 ? "Specials" : `S${x.number}`);
  return (
    <section className={s.section} aria-labelledby="seasons-h">
      <h2 id="seasons-h" className="sec-title">Seasons</h2>
      <p className={s.sub}>{done} of {all.length} episodes watched{finished && <span className={s.finished}>FINISHED</span>}</p>
      <div className={s.seasonBtns} role="group" aria-label="Season">
        {seasons.map((x) => {
          const w = x.episodes.filter((e) => e.watched).length;
          return (
            <button key={x.number} className="btn" aria-pressed={x.number === pick} onClick={() => setPick(x.number)} aria-label={`${x.name}, ${w} of ${x.episodes.length} watched`}>
              {label(x)}<small className={s.count}>{w}/{x.episodes.length}</small>
            </button>
          );
        })}
      </div>
      <h3 className={s.seasonName}>{cur.name}{cur.year ? ` · ${cur.year}` : ""}</h3>
      <ol className={s.episodes}>
        {cur.episodes.map((e) => (
          <li key={e.number} className={e.watched ? s.watched : undefined}>
            <span className={s.epNo}>E{e.number}</span>
            <span className={s.epName}>{e.name || `Episode ${e.number}`}</span>
            {e.onPlex && <span className={s.onPlex}>ON PLEX</span>}
            <span className={s.tick} aria-label={e.watched ? "Watched" : "Not watched"}>{e.watched ? "✓" : ""}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
