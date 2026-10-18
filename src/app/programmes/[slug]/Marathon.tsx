import Link from "next/link";
import type { CSSProperties } from "react";
import { VhsBox } from "@/components/VhsBox";
import { artOf, type Catalog } from "@/lib/catalog";
import { behind, epCode, progress, type Programme, type ProgItem } from "@/lib/programmes";
import { TickBox } from "../client";
import { leadOf, Progress, span } from "../parts";
import s from "../programmes.module.css";

/*
 * The marathon card: the rental card again, but each box is a day (or a week) holding its portion of episodes,
 * each with a tick box. Boxes that were due and aren't done say OVERDUE; finished ones get the WATCHED stamp.
 */
const fmt = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export function Marathon({ p, cat, live, today }: { p: Programme; cat: Catalog; live: boolean; today: string }) {
  const t = leadOf(p, cat);
  const unit = p.extras.unit ?? "day";
  const portions = new Map<string, ProgItem[]>();
  for (const it of [...p.items].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.position - b.position)) {
    const k = it.date ?? "unscheduled";
    portions.set(k, [...(portions.get(k) ?? []), it]);
  }
  const { done, total } = progress(p.items);
  const late = behind(p, today);
  const nextDue = [...portions.entries()].find(([, its]) => its.some((i) => !i.done));
  return (
    <>
      <section className={s.edition}>
        {t && <div className={s.editionBox}><Link href={`/title/${t.id}`} aria-label={`Open the box: ${t.t}`}><VhsBox title={t} art={artOf(cat, t.id)} width={220} kase="clam" wear="rented" view="front" /></Link></div>}
        <div>
          <h1 className={s.h1}>{p.title}</h1>
          {p.theme && <p className={s.lede}>{p.theme}</p>}
          <p className={s.muted}>{span(p)}</p>
          <div style={{ maxWidth: 420, marginTop: 12 }}><Progress done={done} total={total} label="Episodes" /></div>
          {done === total && total > 0 ? <p className={s.status}>Finished. Every episode watched.</p>
            : late ? <p className={s.overdueLine}>Overdue: {late} episode{late === 1 ? "" : "s"} behind. Catch up and the card turns green again.</p>
            : <p className={s.status}>On schedule.</p>}
          {nextDue && <p className={s.muted}>Up next ({nextDue[0] <= today ? "due" : fmt(nextDue[0])}): {nextDue[1].filter((i) => !i.done).map((i) => (i.ep ? epCode(i.ep) : "")).join(", ")}</p>}
          {t && <div className={s.btns}><Link className="btn" href={`/title/${t.id}`} data-autofocus>Open the box</Link></div>}
        </div>
      </section>

      <div className={s.cardWrap}>
        <div className={s.card} style={{ "--acc": p.accent, maxWidth: "none" } as CSSProperties}>
          <div className={s.cardHead}>
            <span className={s.cardBrand}><b>VIDEO</b><i>Cinematheque</i></span>
            <span className={s.cardTitle}>{p.title}</span>
            <span className={s.cardMember}>Marathon card · {p.extras.per ?? 1} a {unit}</span>
          </div>
          <div className={s.cardStats}>
            <span><b>{done}</b> of {total} episodes</span>
            {late > 0 && <span className={s.streak}><b>{late}</b> behind</span>}
          </div>
          <ol className={s.mDays}>
            {[...portions.entries()].map(([date, its], n) => {
              const all = its.every((i) => i.done);
              const overdue = !all && date !== "unscheduled" && date < today;
              const isNow = !all && !overdue && date === nextDue?.[0];
              return (
                <li key={date} className={`${all ? s.stamped : ""} ${overdue ? s.mLate : ""} ${isNow ? s.todayBox : ""}`}>
                  <span className={s.dayNo}>{unit === "week" ? "Week" : "Day"} {n + 1}</span>
                  <span className={s.dayDate}>{date === "unscheduled" ? "Any time" : `${unit === "week" ? "from " : ""}${fmt(date)}`}</span>
                  {all && <span className={s.stamp}>Watched</span>}
                  {overdue && <span className={`${s.stamp} ${s.stampLate}`}>Overdue</span>}
                  <ul className={s.mEps}>
                    {its.map((it) => (
                      <li key={it.position}>
                        <span className={s.mCode}>{it.ep ? epCode(it.ep) : "?"}</span>
                        <span className={s.mName}>{it.ep?.name || ""}</span>
                        <TickBox slug={p.slug} position={it.position} done={it.done} title={`${t?.t ?? ""} ${it.ep ? epCode(it.ep) : ""}`.trim()} live={live} />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </>
  );
}
