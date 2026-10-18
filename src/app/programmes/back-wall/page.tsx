import Link from "next/link";
import type { CSSProperties } from "react";
import { getCatalog } from "@/lib/catalog";
import { getProgrammes, isRunning, progress } from "@/lib/programmes";
import { Poster, span } from "../parts";
import s from "../programmes.module.css";

export const metadata = { title: "The Back Wall · The Cinematheque" };

/*
 * The Back Wall: every programme that's over (ended, finished or taken down), its poster taped up slightly crooked,
 * newest first, with how much of it you saw. Choosing one straightens it and lifts it off the wall.
 */
const tilt = (slug: string) => { let h = 0; for (const c of slug) h = (h * 31 + c.charCodeAt(0)) | 0; return ((Math.abs(h) % 7) - 3) * 0.9; };

export default async function BackWall() {
  const [cat, progs] = await Promise.all([getCatalog(), getProgrammes()]);
  const t = progs.today;
  const past = progs.list
    .filter((p) => p.type !== "edition" && p.type !== "family_tree" && p.status !== "draft" && !isRunning(p, t))
    .sort((a, b) => (b.end ?? b.start ?? "").localeCompare(a.end ?? a.start ?? ""));
  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label"><Link href="/programmes">Festival wall</Link> · Archive</div><h1 className={s.h1}>The back wall</h1></div>
      </div>
      <p className={s.lede}>Every programme that&apos;s over: festivals, 31 Days, marathons, courses and the rest, taped up where they ended.</p>
      {!past.length ? <p className={s.muted}>Nothing on the back wall yet. Programmes go up here when they end or are taken down. <Link href="/programmes" data-autofocus>Back to the festival wall</Link>.</p> : (
        <div className={s.backWall}>
          {past.map((p, i) => {
            const { done, total } = progress(p.items);
            return (
              <Link key={p.slug} href={`/programmes/${p.slug}`} className={s.taped} style={{ "--tilt": `${tilt(p.slug)}deg` } as CSSProperties}
                aria-label={`${p.title}, ${span(p)}${total ? `, ${done} of ${total} seen` : ""}${p.status === "archived" ? ", taken down" : ""}`} data-autofocus={i === 0 ? true : undefined}>
                <span className={s.tapeStrip} aria-hidden="true" />
                <span className={`${s.tapeStrip} ${s.tapeStripRight}`} aria-hidden="true" />
                <Poster p={p} cat={cat} />
                <span className={s.tag}>{span(p)}{total ? ` · ${done} of ${total} seen` : ""}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
