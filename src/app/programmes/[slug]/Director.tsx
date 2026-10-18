import Link from "next/link";
import type { CSSProperties } from "react";
import { VhsBox } from "@/components/VhsBox";
import { artOf, findTitle, type Catalog } from "@/lib/catalog";
import { progress, type Programme } from "@/lib/programmes";
import { ThemesTools, TickBox, TopTen } from "../client";
import { Progress } from "../parts";
import s from "../programmes.module.css";

/*
 * The Director's Shelf: one shelf of the films in viewing order, numbered, a handwritten staff card of themes to
 * watch for, and the Top 10 chalkboard (the member's ranking, once a few are watched).
 */
export function Director({ p, cat, live, canWrite }: { p: Programme; cat: Catalog; live: boolean; canWrite: boolean }) {
  const items = [...p.items].sort((a, b) => a.position - b.position);
  const { done, total } = progress(items);
  const watched = items.filter((i) => i.done).map((i) => findTitle(cat, i.id)).filter((t) => !!t);
  const rank = p.extras.top10 ?? [];
  const ranked = [...watched].sort((a, b) => {
    const ia = rank.indexOf(a.id), ib = rank.indexOf(b.id);
    return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
  });
  const themes = p.extras.themes;
  return (
    <>
      <h1 className={s.h1}>{p.extras.person?.name ?? p.title}</h1>
      <p className={s.lede}>A retrospective. {p.theme}</p>
      <div style={{ maxWidth: 460, marginTop: 10 }}><Progress done={done} total={total} label="Films" /></div>

      <section className={s.section} aria-label="The shelf, in viewing order">
        <div className={s.courseShelf}>
          {items.map((it, i) => {
            const t = findTitle(cat, it.id);
            if (!t) return null;
            return (
              <div key={it.position} className={s.courseTape}>
                <span className={s.orderNo}>No. {i + 1}</span>
                <Link href={`/title/${t.id}`} className={s.tape} aria-label={`Number ${i + 1}: ${t.t}${t.y ? `, ${t.y}` : ""}${it.done ? ", seen" : ""}`} data-autofocus={i === 0 ? true : undefined}>
                  <span className={s.tapeBox}><VhsBox title={t} art={artOf(cat, t.id)} width={110} wear={it.done ? "loved" : "mint"} /></span>
                </Link>
                <span className={s.courseLabel}>
                  <TickBox slug={p.slug} position={it.position} done={it.done} title={t.t} live={live} />
                  <span>{t.t} <small>{t.y || ""}</small></span>
                </span>
              </div>
            );
          })}
        </div>
        <div className={s.shelfBoard} aria-hidden="true" />
      </section>

      <div className={s.directorBoards}>
        <section aria-labelledby="themes-h">
          <div className={s.staffCard} style={{ "--acc": p.accent } as CSSProperties}>
            <h2 id="themes-h" className={s.staffTitle}>Themes to watch for</h2>
            {themes?.text ? themes.text.split(/\n+/).map((line, i) => <p key={i}>{line}</p>)
              : <p>No card yet.{canWrite ? " Claude can write one from the director's Wikipedia article." : " Write one yourself."}</p>}
            {themes?.text && <p className={s.staffFoot}>{themes.draft ? "Draft · check it against the article" : "Checked"}{themes.source && <> · <a href={themes.source} target="_blank" rel="noreferrer">Wikipedia</a></>}</p>}
          </div>
          {live && <ThemesTools slug={p.slug} text={themes?.text ?? ""} draft={themes?.draft ?? true} canWrite={canWrite} />}
        </section>
        <section aria-label="Top 10">
          {ranked.length >= 3 && live ? <TopTen slug={p.slug} films={ranked.map((t) => ({ id: t.id, t: t.t, y: t.y }))} />
            : (
              <div className={s.chalk}>
                <div className={s.chalkTitle}>Top 10</div>
                <p className={s.chalkEmpty}>{ranked.length >= 3 ? ranked.slice(0, 10).map((t, i) => `${i + 1}. ${t.t}`).join("  ") : `Watch three to start ranking. ${ranked.length} so far.`}</p>
              </div>
            )}
        </section>
      </div>
    </>
  );
}
