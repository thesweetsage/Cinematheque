/* eslint-disable @next/next/no-img-element -- small poster thumbnails in the match check */
import Link from "next/link";
import type { CSSProperties } from "react";
import { VhsBox } from "@/components/VhsBox";
import { artOf, findTitle, type Catalog } from "@/lib/catalog";
import { progress, type Programme, type ProgItem } from "@/lib/programmes";
import { RemoveItem, StatusButton, TickBox } from "../client";
import { Progress } from "../parts";
import s from "../programmes.module.css";

/*
 * The Course Shelf: a curriculum as a shelf per chapter (Part I, II, III, or a year each), with a progress bar per
 * shelf and a completion seal. Fresh from the list it's a draft: first you check each TMDB match against the line
 * you pasted, take off the wrong ones, then put it on the shelf.
 */

export const chaptersOf = (items: ProgItem[]) => {
  const out = new Map<string, ProgItem[]>();
  for (const it of [...items].sort((a, b) => a.position - b.position)) { const k = it.chapter || "The list"; out.set(k, [...(out.get(k) ?? []), it]); }
  return [...out.entries()];
};

export function Course({ p, cat, live }: { p: Programme; cat: Catalog; live: boolean }) {
  const chapters = chaptersOf(p.items);
  const { done, total } = progress(p.items);
  const complete = total > 0 && done === total;
  if (p.status === "draft" && live) return <CheckMatches p={p} cat={cat} chapters={chapters} />;
  return (
    <>
      <div className={s.courseHead} style={{ "--acc": p.accent } as CSSProperties}>
        <div>
          <h1 className={s.h1}>{p.title}</h1>
          <p className={s.lede}>{total} title{total === 1 ? "" : "s"} in {chapters.length} chapter{chapters.length === 1 ? "" : "s"}.{p.theme ? ` ${p.theme}` : ""}</p>
          <div style={{ maxWidth: 460, marginTop: 10 }}><Progress done={done} total={total} label="The whole course" /></div>
        </div>
        {complete && <span className={s.seal} role="img" aria-label="Course complete">Course<br />complete</span>}
      </div>
      {chapters.map(([name, its], ci) => {
        const pr = progress(its);
        return (
          <section key={name} className={s.section} aria-labelledby={`ch-${ci}`}>
            <div className={s.sectionHead}>
              <h2 id={`ch-${ci}`} className="sec-title">{name}</h2>
              <span className={s.chapterProgress}><Progress done={pr.done} total={pr.total} label={name} />{pr.done === pr.total && <span className={s.sealSmall}>Done</span>}</span>
            </div>
            <div className={s.courseShelf}>
              {its.map((it, i) => {
                const t = findTitle(cat, it.id);
                if (!t) return null;
                return (
                  <div key={it.position} className={s.courseTape}>
                    <Link href={`/title/${t.id}`} className={s.tape} aria-label={`${t.t}${t.y ? `, ${t.y}` : ""}${it.done ? ", seen" : ""}`} data-autofocus={ci === 0 && i === 0 ? true : undefined}>
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
        );
      })}
      {!!p.extras.unmatched?.length && (
        <section className={s.section} aria-labelledby="missing">
          <h2 id="missing" className="sec-title">Not found on TMDB</h2>
          <p className={s.muted}>These lines from the list couldn&apos;t be matched. Find them in the Returns Slot and add them with Edit programme.</p>
          <ul className={s.unmatched}>{p.extras.unmatched.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </section>
      )}
    </>
  );
}

function CheckMatches({ p, cat, chapters }: { p: Programme; cat: Catalog; chapters: [string, ProgItem[]][] }) {
  return (
    <>
      <h1 className={s.h1}>{p.title}</h1>
      <p className={s.lede}>Check the matches. Each line you pasted was looked up on TMDB: take off any wrong ones, then put the course on the shelf.</p>
      <div className={s.btns}>
        <StatusButton slug={p.slug} status="live" label="Looks right: put it on the Course Shelf" primary autofocus />
      </div>
      {chapters.map(([name, its]) => (
        <section key={name} className={s.section} aria-label={name}>
          <h2 className={s.h2}>{name}</h2>
          <ol className={s.matchList}>
            {its.map((it) => {
              const t = findTitle(cat, it.id);
              if (!t) return null;
              const poster = artOf(cat, t.id).poster;
              return (
                <li key={it.position}>
                  {poster ? <img src={poster} alt="" width={46} height={69} /> : <span className={s.noPoster} />}
                  <span className={s.matchText}>
                    <b>{t.t} <small>{t.y || ""}{t.kind === "series" ? " · series" : ""}</small></b>
                    {it.note && <small>You pasted: {it.note}</small>}
                  </span>
                  <RemoveItem slug={p.slug} position={it.position} label={t.t} text="✕ Wrong match" />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {!!p.extras.unmatched?.length && (
        <section className={s.section} aria-label="Not found">
          <h2 className={s.h2}>Not found on TMDB ({p.extras.unmatched.length})</h2>
          <ul className={s.unmatched}>{p.extras.unmatched.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </section>
      )}
      <div className={s.btns}><StatusButton slug={p.slug} status="live" label="Put it on the Course Shelf" primary /></div>
    </>
  );
}
