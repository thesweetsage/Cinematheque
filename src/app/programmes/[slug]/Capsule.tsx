import type { CSSProperties } from "react";
import type { Catalog } from "@/lib/catalog";
import { progress, type Programme } from "@/lib/programmes";
import { CapsuleTools } from "../client";
import { Flyer, Progress, span } from "../parts";
import s from "../programmes.module.css";

/*
 * Year in a decade: the year in neon, the month's schedule on the flyer, and three panels from that year:
 * what was on the radio, what was in the news, what people wore (from Wikipedia, a draft until checked).
 */
export function Capsule({ p, cat, live, canWrite }: { p: Programme; cat: Catalog; live: boolean; canWrite: boolean }) {
  const cap = p.extras.capsule;
  const { done, total } = progress(p.items);
  const host = (u: string) => decodeURIComponent(u.split("/wiki/")[1] ?? u).replace(/_/g, " ");
  return (
    <>
      <section className={s.wall}>
        <div className={s.yearSign} style={{ "--acc": p.accent } as CSSProperties} aria-hidden="true">{p.extras.year}</div>
        <div className={s.wallSide}>
          <h1 className={s.h1}>{p.title}</h1>
          {p.theme && <p className={s.lede}>{p.theme}</p>}
          <p className={s.muted}>{span(p)}</p>
          <div style={{ width: "100%", maxWidth: 420 }}><Progress done={done} total={total} /></div>
          <Flyer p={p} cat={cat} live={live} focus />
        </div>
      </section>
      <section className={s.section} aria-labelledby="capsule-h">
        <div className={s.sectionHead}><h2 id="capsule-h" className="sec-title">{p.extras.year}, the year</h2>{cap && <span className={s.muted}>{cap.draft ? "Draft: check it against the articles" : "Checked"}</span>}</div>
        {cap ? (
          <div className={s.capsule}>
            <div className={s.capPanel}><h3>On the radio</h3><ul>{cap.albums.map((a, i) => <li key={i}><b>{a.title}</b> · {a.artist}{a.note ? <small>{a.note}</small> : null}</li>)}</ul></div>
            <div className={s.capPanel}><h3>In the news</h3><ul>{cap.events.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
            <div className={s.capPanel}><h3>What people wore</h3><ul>{cap.fashion.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
          </div>
        ) : <p className={s.muted}>No notes yet.{canWrite ? " Claude writes them from Wikipedia's articles on the year." : ""}</p>}
        {cap && cap.sources.length > 0 && <p className={s.sources}>From Wikipedia: {cap.sources.map((u, i) => <span key={u}>{i ? " · " : ""}<a href={u} target="_blank" rel="noreferrer">{host(u)}</a></span>)}</p>}
        {live && <CapsuleTools slug={p.slug} has={!!cap} draft={cap?.draft ?? true} canWrite={canWrite} />}
      </section>
      {p.essay && (
        <section className={s.booklet} aria-label="Programme notes">
          <div className={s.bookletKicker}>Programme notes</div>
          {p.essay.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
        </section>
      )}
    </>
  );
}
