import Link from "next/link";
import type { CSSProperties } from "react";
import { VhsBox } from "@/components/VhsBox";
import { artOf, findTitle, type Catalog } from "@/lib/catalog";
import { addDays, behind, daysBetween, progress, stamps, TYPE_NAME, type Programme } from "@/lib/programmes";
import { TickBox } from "./client";
import s from "./programmes.module.css";

/* The printed things on the festival wall: the poster, the tick-off flyer and the 31 Days rental card. */

const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-GB", opts);
export const span = (p: Programme) => p.start ? `${fmt(p.start, { day: "numeric", month: "short" })}${p.end && p.end !== p.start ? ` to ${fmt(p.end, { day: "numeric", month: "short", year: "numeric" })}` : ""}` : "No dates yet";

/** The festival poster: a screen-printed sheet in the programme's colour. */
export function Poster({ p, cat, big = false }: { p: Programme; cat: Catalog; big?: boolean }) {
  const lead = p.items.map((it) => findTitle(cat, it.id)).find(Boolean);
  const backdrop = lead && artOf(cat, lead.id).backdrop;
  return (
    <div className={`${s.poster} ${big ? s.posterBig : ""}`} style={{ "--acc": p.accent } as CSSProperties}>
      {backdrop && <span className={s.posterArt} style={{ backgroundImage: `url(${backdrop})` }} />}
      <span className={s.posterKicker}>{p.type === "days31" ? "A Cinematheque challenge" : p.type === "festival" ? "A Cinematheque festival" : `A Cinematheque ${TYPE_NAME[p.type].toLowerCase()}`}</span>
      <span className={s.posterTitle}>{p.title}</span>
      {p.theme && <span className={s.posterTheme}>{p.theme}</span>}
      <span className={s.posterFoot}><b>{span(p)}</b><i>{p.items.length} {p.items.length === 1 ? "title" : "titles"}</i></span>
      <span className={s.pin} aria-hidden="true" />
    </div>
  );
}

/** The flyer under the poster: the schedule, each title with a pen-drawn tick box. */
export function Flyer({ p, cat, live, compact = false, focus = false }: { p: Programme; cat: Catalog; live: boolean; compact?: boolean; focus?: boolean }) {
  const items = [...p.items].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.position - b.position);
  const done = items.filter((i) => i.done).length;
  return (
    <div className={s.flyer}>
      <div className={s.flyerHead}><b>The programme</b><span>{done} of {items.length} seen</span></div>
      {!items.length && <p className={s.flyerEmpty}>No titles on the bill yet.</p>}
      <ol className={s.bill}>
        {items.map((it) => {
          const t = findTitle(cat, it.id);
          if (!t) return null;
          return (
            <li key={it.position} className={it.done ? s.seen : undefined}>
              <span className={s.when}>{it.date ? fmt(it.date) : "TBA"}</span>
              <span className={s.what}>
                <Link href={`/title/${t.id}`} data-autofocus={focus && it === items[0] ? true : undefined}>{t.t}</Link> <small>{t.y || ""}</small>{!t.plex && <small className={s.notOwned}> · not on Plex</small>}
                {!compact && it.note && <em>{it.note}</em>}
                {!compact && it.done && it.doneAt && <small className={s.how}>Seen {fmt(it.doneAt.slice(0, 10))}</small>}
              </span>
              <TickBox slug={p.slug} position={it.position} done={it.done} title={t.t} live={live} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The 31 Days rental card: one box per day, stamped with what was returned that day, and the streak. */
export function RentalCard({ p, cat, today, compact = false }: { p: Programme; cat: Catalog; today: string; compact?: boolean }) {
  const { byDay, streak, stamped } = stamps(p, today);
  const start = p.start ?? today;
  const days = Math.min(31, Math.max(1, p.end ? daysBetween(start, p.end) + 1 : 31));
  const t0 = today;
  return (
    <div className={`${s.card} ${compact ? s.cardCompact : ""}`} style={{ "--acc": p.accent } as CSSProperties}>
      <div className={s.cardHead}>
        <span className={s.cardBrand}><b>VIDEO</b><i>Cinematheque</i></span>
        <span className={s.cardTitle}>{p.title}</span>
        <span className={s.cardMember}>Rental card · {span(p)}</span>
      </div>
      <div className={s.cardStats}>
        <span><b>{stamped}</b> of {days} days</span>
        <span className={s.streak}><b>{streak}</b> day streak</span>
      </div>
      <ol className={s.days}>
        {Array.from({ length: days }, (_, i) => {
          const d = addDays(start, i);
          const got = byDay.get(d);
          const t = got?.[0] && findTitle(cat, got[0].id);
          return (
            <li key={d} className={`${got ? s.stamped : ""} ${d === t0 ? s.todayBox : ""} ${d > t0 ? s.future : ""}`} aria-label={`Day ${i + 1}, ${fmt(d)}${t ? `: ${t.t}` : got ? ": returned" : ""}`}>
              <span className={s.dayNo}>{i + 1}</span>
              <span className={s.dayDate}>{fmt(d)}</span>
              {got && <span className={s.stamp}>Returned</span>}
              {!compact && t && <span className={s.dayTitle}>{t.t}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A row of tapes (editions on the Staff Picks shelf, pairs, the end poster). */
export function TapeRow({ ids, cat, width = 140, label }: { ids: { id: string; href: string; edition?: string }[]; cat: Catalog; width?: number; label?: (id: string) => string }) {
  return (
    <div className={s.tapes}>
      {ids.map(({ id, href, edition }) => {
        const t = findTitle(cat, id);
        if (!t) return null;
        return (
          <Link key={href} href={href} className={s.tape} aria-label={label ? label(id) : `${t.t}, ${t.y}`}>
            <span className={s.tapeBox}><VhsBox title={t} art={artOf(cat, t.id)} width={width} edition={edition} wear="mint" /></span>
          </Link>
        );
      })}
    </div>
  );
}

/** A programme's lead title: the series of a marathon, the root of a family tree, the first film of anything else. */
export const leadOf = (p: Programme, cat: Catalog) => p.items.map((it) => findTitle(cat, it.id)).find(Boolean);

/** A progress bar (done of total), with the count spoken. */
export function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className={s.progress} role="img" aria-label={`${label ? `${label}: ` : ""}${done} of ${total} seen`}>
      <span className={s.progressBar}><i style={{ width: `${pct}%` }} /></span>
      <span className={s.progressText}>{done} / {total}</span>
    </span>
  );
}

/**
 * The v2 programmes on the festival wall: one tile each, the lead title's box, the name, a line about it,
 * a progress bar, and an OVERDUE sticker when a marathon has fallen behind.
 */
export function ProgTiles({ list, cat, today, line }: { list: Programme[]; cat: Catalog; today: string; line?: (p: Programme) => string }) {
  return (
    <div className={s.tiles}>
      {list.map((p) => {
        const t = leadOf(p, cat);
        const { done, total } = progress(p.items);
        const late = p.type === "marathon" ? behind(p, today) : 0;
        const sub = line?.(p) ?? (p.status === "draft" ? "Draft" : TYPE_NAME[p.type]);
        return (
          <Link key={p.slug} href={`/programmes/${p.slug}`} className={s.tile} aria-label={`${p.title}. ${sub}${total && p.type !== "family_tree" ? `. ${done} of ${total} seen` : ""}${late ? `. ${late} behind` : ""}`}>
            <span className={s.tileBox}>
              {p.type === "time_capsule" && p.extras.year ? <span className={s.tileYear} style={{ "--acc": p.accent } as CSSProperties}>{p.extras.year}</span>
                : t ? <VhsBox title={t} art={artOf(cat, t.id)} width={120} wear="mint" /> : <span className={s.tileYear}>?</span>}
            </span>
            <span className={s.tileName}>{p.title}</span>
            <span className={s.tileSub}>{sub}</span>
            {total > 0 && p.type !== "family_tree" && <Progress done={done} total={total} />}
            {late > 0 && <span className={s.overdue}>Overdue · {late} behind</span>}
          </Link>
        );
      })}
    </div>
  );
}
