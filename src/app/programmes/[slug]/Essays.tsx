import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { artOf, findTitle, type Catalog } from "@/lib/catalog";
import type { Programme } from "@/lib/programmes";
import { ItemEssayTools, TickBox } from "../client";
import { chaptersOf } from "./Course";
import s from "../programmes.module.css";

/*
 * An essay series (the Final Girls Archive): a timeline by era, each title's box with its heroine's name and the
 * essay beside it in the store's own panel, full width. Essays are drafts until checked.
 */
export function Essays({ p, cat, live, canWrite }: { p: Programme; cat: Catalog; live: boolean; canWrite: boolean }) {
  const eras = chaptersOf(p.items);
  const written = p.items.filter((i) => i.essay).length;
  const firstPos = eras[0]?.[1][0]?.position;
  return (
    <>
      <h1 className={s.h1}>{p.title}</h1>
      {p.theme && <p className={s.lede}>{p.theme}</p>}
      <p className={s.muted}>{written} of {p.items.length} essays written.{!p.items.length && live ? " Add titles with Edit programme." : ""}</p>
      {eras.map(([era, its]) => (
        <section key={era} className={s.era} aria-label={era}>
          <h2 className={s.eraLabel}>{era}</h2>
          {its.map((it) => {
            const t = findTitle(cat, it.id);
            if (!t) return null;
            const auto = it.position === firstPos;
            return (
              <article key={it.position} className={s.entry}>
                <div className={s.entryBox}>
                  <Link href={`/title/${t.id}`} aria-label={`${t.t}${t.y ? `, ${t.y}` : ""}`} data-autofocus={auto ? true : undefined}><VhsBox title={t} art={artOf(cat, t.id)} width={130} wear="rented" /></Link>
                  <span className={s.courseLabel}><TickBox slug={p.slug} position={it.position} done={it.done} title={t.t} live={live} /><span>Seen</span></span>
                </div>
                <div className={s.entryText}>
                  {it.note && <div className={s.heroine}>{it.note}</div>}
                  <h3 className={s.entryTitle}>{t.t} <small>{t.y || ""}</small></h3>
                  <div className={s.essayPanel}>
                    {it.essay ? it.essay.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>) : <p className={s.muted}>No essay yet.</p>}
                    {it.essay && it.essayDraft && <p className={s.draftNote}>Draft: read it against the film&apos;s Wikipedia article, then mark it checked.</p>}
                  </div>
                  {live && <ItemEssayTools slug={p.slug} position={it.position} essay={it.essay ?? ""} draft={it.essayDraft ?? true} canWrite={canWrite} label={t.t} />}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </>
  );
}
