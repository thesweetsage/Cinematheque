import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { aisles, artOf, getCatalog, shelf } from "@/lib/catalog";
import s from "./shelves.module.css";

export const metadata = { title: "The Shelves · The Cinematheque" };

const SIGN: Record<string, string> = { HORROR: "var(--mag)", "ROM-COM": "var(--yellow)", "SCI-FI": "var(--cyan)", FANTASY: "#c9b6ff", ANIME: "var(--cyan)", COMEDY: "var(--yellow)", SERIES: "var(--orange)" };

/* Covers first: every tape faces out, turned slightly so its spine shows on the left. */
export default async function Shelves() {
  const cat = await getCatalog();
  const lib = shelf(cat);
  const rows = aisles(lib);
  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label">{rows.length ? `Aisles 1 to ${rows.length}` : "No aisles yet"} · {lib.length} titles</div><h1 className={s.h1}>The shelves</h1></div>
        <SampleTag catalog={cat} />
      </div>
      {!lib.length && (
        <p style={{ color: "var(--muted)" }}>
          The shelves are empty. <Link href="/search" data-autofocus>Find a film in the Returns Slot</Link> and put it on the shelf.
        </p>
      )}
      {rows.map(({ g, titles }, gi) => (
        <section key={g} className={s.aisle} aria-labelledby={`sign-${g}`}>
          <div className={s.signWrap}><h2 id={`sign-${g}`} className={s.sign} style={{ "--sc": SIGN[g] ?? "var(--lav)" } as React.CSSProperties}>{g}</h2></div>
          <div className={s.rack}>
            <div className={s.row}>
              {titles.map((t, i) => (
                <Link key={t.id} href={`/title/${t.id}`} className={s.slot} aria-label={`${t.t}, ${t.y}`} data-autofocus={gi === 0 && i === 0 ? true : undefined}>
                  <span className={s.boxWrap}><VhsBox title={t} art={artOf(cat, t.id)} width={150} wear={(["rented", "loved", "mint", "rented"] as const)[i % 4]} edition={cat.editions[t.id]} /></span>
                  <span className={s.cap}>{t.t}<small>{t.y || ""}</small></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
