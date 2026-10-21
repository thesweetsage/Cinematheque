import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { aisles, editions, loadCatalogue, shelf } from "@/lib/catalog";
import s from "./shelves.module.css";

export const metadata = { title: "The Shelves · The Cinematheque" };

const SIGN: Record<string, string> = { HORROR: "var(--mag)", "ROM-COM": "var(--yellow)", FANTASY: "#c9b6ff", ANIME: "var(--cyan)", SERIES: "var(--orange)" };
const NEON = ["var(--mag)", "var(--yellow)", "var(--cyan)", "#c9b6ff", "var(--orange)"];
const signId = (g: string) => `sign-${g.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/* Covers first: every tape faces out, turned slightly so its spine shows on the left. */
export default async function Shelves() {
  const c = await loadCatalogue();
  const lib = shelf(c);
  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label">Aisles 1 to {aisles(c).length} · {lib.length} titles</div><h1 className={s.h1}>The shelves</h1></div>
        {c.sample && <SampleTag />}
      </div>
      {aisles(c).map(({ sign: g, entries }, gi) => (
        <section key={g} className={s.aisle} aria-labelledby={signId(g)}>
          <div className={s.signWrap}><h2 id={signId(g)} className={s.sign} style={{ "--sc": SIGN[g] ?? NEON[gi % NEON.length] } as React.CSSProperties}>{g}</h2></div>
          <div className={s.rack}>
            <div className={s.row}>
              {entries.map(({ title: t, art }, i) => (
                <Link key={t.id} href={`/title/${t.id}`} className={s.slot} aria-label={`${t.t}, ${t.y}`} data-autofocus={gi === 0 && i === 0 ? true : undefined}>
                  <span className={s.boxWrap}><VhsBox title={t} art={art} width={150} wear={(["rented", "loved", "mint", "rented"] as const)[i % 4]} edition={c.sample ? editions[t.id] : undefined} /></span>
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
