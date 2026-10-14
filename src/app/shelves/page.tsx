import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { GENRES, artFor, editions, libraryTitles } from "@/lib/catalog";
import s from "./shelves.module.css";

export const metadata = { title: "The Shelves · The Cinematheque" };

const SIGN: Record<string, string> = { HORROR: "var(--mag)", "ROM-COM": "var(--yellow)", FANTASY: "#c9b6ff", ANIME: "var(--cyan)", SERIES: "var(--orange)" };

/* Covers first: every tape faces out, turned slightly so its spine shows on the left. */
export default function Shelves() {
  const lib = libraryTitles();
  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label">Aisles 1 to 5 · {lib.length} titles</div><h1 className={s.h1}>The shelves</h1></div>
        <SampleTag />
      </div>
      {GENRES.map((g, gi) => (
        <section key={g} className={s.aisle} aria-labelledby={`sign-${g}`}>
          <div className={s.signWrap}><h2 id={`sign-${g}`} className={s.sign} style={{ "--sc": SIGN[g] } as React.CSSProperties}>{g}</h2></div>
          <div className={s.rack}>
            <div className={s.row}>
              {lib.filter((t) => t.g === g).map((t, i) => (
                <Link key={t.id} href={`/title/${t.id}`} className={s.slot} aria-label={`${t.t}, ${t.y}`} data-autofocus={gi === 0 && i === 0 ? true : undefined}>
                  <span className={s.boxWrap}><VhsBox title={t} art={artFor(t.id)} width={150} wear={(["rented", "loved", "mint", "rented"] as const)[i % 4]} edition={editions[t.id]} /></span>
                  <span className={s.cap}>{t.t}<small>{t.y}</small></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
