import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { WalkIn } from "@/components/WalkIn";
import { SampleTag } from "@/components/SampleTag";
import { getCatalog } from "@/lib/catalog";
import { getProgrammes, spineLabel, TYPE_NAME, type Programme } from "@/lib/programmes";
import { Flyer, Poster, RentalCard, span, TapeRow } from "./parts";
import s from "./programmes.module.css";

export const metadata = { title: "The Festival Wall · The Cinematheque" };

/*
 * The festival wall: this month's festival poster with its tick-off flyer, the 31 Days rental card,
 * the Staff Picks shelf of numbered editions, and the back room (drafts and past programmes).
 */
export default async function FestivalWall() {
  const [cat, progs] = await Promise.all([getCatalog(), getProgrammes()]);
  const live = progs.source === "db";
  const t = progs.today;
  const running = (type: string) => progs.list.filter((p) => p.type === type && p.status === "live" && (!p.end || p.end >= t) && (!p.start || p.start <= t || type !== "festival"));
  const festivals = running("festival"), challenges = running("days31");
  const editions = progs.list.filter((p) => p.type === "edition" && p.status !== "draft").sort((a, b) => (a.spine ?? 0) - (b.spine ?? 0));
  const shown = new Set([...festivals, ...challenges].map((p) => p.slug));
  const backRoom = progs.list.filter((p) => p.type !== "edition" && !shown.has(p.slug));
  const footage = wallFootage();
  // The board photo frames what's now showing (or the empty-wall note), not a wall with only a 31 Days below it.
  const onBoard = !!footage.still && (festivals.length > 0 || !challenges.length);
  const showing = (p: Programme, first: boolean, label: string) => (
    <section key={p.slug} className={s.wall} aria-label={`${p.title}, ${label.toLowerCase()}`}>
      <Link href={`/programmes/${p.slug}`} className={s.posterLink} aria-label={`Open the programme: ${p.title}`} data-autofocus={first ? true : undefined}><Poster p={p} cat={cat} /></Link>
      <div className={s.wallSide}>
        <div className="osd-label">{label} · {TYPE_NAME.festival}</div>
        <Flyer p={p} cat={cat} live={live} compact />
        <Link className="btn" href={`/programmes/${p.slug}`}>Open the programme</Link>
      </div>
    </section>
  );

  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label">Programmes · {new Date(`${t}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div><h1 className={s.h1}>The festival wall</h1></div>
        <div className={s.headTools}>
          <SampleTag catalog={cat} />
          {live && <Link className="btn primary" href="/programmes/new" data-autofocus={!festivals.length && !challenges.length ? true : undefined}>+ Start a programme</Link>}
        </div>
      </div>

      {footage.pan && <WalkIn src={footage.pan} poster={footage.still} storageKey="cine_pan" label="Turning to the festival wall" replay="cine:pan" />}
      <div className={onBoard ? s.board : undefined} style={onBoard ? ({ "--wall": `url(${footage.still})` } as React.CSSProperties) : undefined}>
        {!festivals.length && !challenges.length && (
          <p className={s.lede}>Nothing on the wall this month. Start a festival (any theme: rom-coms, medieval, one decade, one country) or a 31 Days of ___ challenge.</p>
        )}
        {festivals.slice(0, onBoard ? 1 : undefined).map((p, i) => showing(p, i === 0, "Now showing"))}
      </div>
      {/* The board holds one festival; any others running at the same time hang below it. */}
      {onBoard && festivals.slice(1).map((p) => showing(p, false, "Also showing"))}

      {challenges.map((p, i) => (
        <section key={p.slug} className={s.section} aria-label={p.title}>
          <div className={s.sectionHead} style={{ justifyContent: "flex-start" }}><h2 className="sec-title">{p.title}</h2><Link className="btn" href={`/programmes/${p.slug}`} data-autofocus={!festivals.length && i === 0 ? true : undefined}>Open the rental card</Link></div>
          <RentalCard p={p} cat={cat} today={t} compact />
        </section>
      ))}

      <section className={s.section} aria-labelledby="collection">
        <div className={s.sectionHead}>
          <h2 id="collection" className="sec-title">The collection</h2>
          <span className={s.muted}>Your hall of fame: induct a title from its box. {editions.length} {editions.length === 1 ? "edition" : "editions"}.</span>
        </div>
        {editions.length ? (
          <TapeRow cat={cat} ids={editions.map((e) => ({ id: e.items[0]?.id, href: `/programmes/${e.slug}`, edition: String(e.spine ?? "").padStart(3, "0") })).filter((x) => x.id)}
            label={(id) => `${spineLabel(editions.find((e) => e.items[0]?.id === id)?.spine)}: ${cat.titles.find((x) => x.id === id)?.t ?? id}`} />
        ) : <p className={s.muted}>No editions yet. Open a favourite&apos;s box and choose “Induct into the collection”.</p>}
      </section>

      {backRoom.length > 0 && (
        <section className={s.section} aria-labelledby="backroom">
          <h2 id="backroom" className="sec-title">The back room</h2>
          <ul className={s.backRoom}>
            {backRoom.map((p) => (
              <li key={p.slug}>
                <Link href={`/programmes/${p.slug}`}>{p.title}</Link>
                <span>{TYPE_NAME[p.type]} · {span(p)} · {p.status === "archived" ? "taken down" : p.status === "draft" ? "draft" : p.start && p.start > t ? "coming up" : "finished"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/*
 * The pan from the shelves to the festival board, if it's been rendered: public/store/pan.mp4 and its end frame
 * public/store/wall.jpg, which then stays behind this month's poster and flyer.
 */
function wallFootage() {
  const has = (f: string) => existsSync(path.join(process.cwd(), "public", "store", f));
  const still = has("wall.jpg") ? "/store/wall.jpg" : null;
  return { pan: still && has("pan.mp4") ? "/store/pan.mp4" : null, still };
}
