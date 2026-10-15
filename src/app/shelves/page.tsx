import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { aisles, artOf, getCatalog, shelf } from "@/lib/catalog";
import s from "./shelves.module.css";

export const metadata = { title: "The Shelves · The Cinematheque" };

const SIGN: Record<string, string> = { HORROR: "var(--mag)", "ROM-COM": "var(--yellow)", "SCI-FI": "var(--cyan)", FANTASY: "#c9b6ff", ANIME: "var(--cyan)", COMEDY: "var(--yellow)", DRAMA: "var(--orange)", CRIME: "var(--mag)", THRILLER: "var(--orange)", SERIES: "var(--orange)" };

/* Covers first: every tape faces out, turned slightly so its spine shows on the left. */
export default async function Shelves({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const kind = (await searchParams).kind === "series" ? "series" : "movie";
  const cat = await getCatalog();
  const all = shelf(cat);
  const lib = all.filter((t) => t.kind === kind);
  const rows = aisles(lib);
  const count = (k: string) => all.filter((t) => t.kind === k).length;
  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label">{rows.length ? `Aisles 1 to ${rows.length}` : "No aisles yet"} · {lib.length} {kind === "series" ? "series" : "films"}</div><h1 className={s.h1}>The shelves</h1></div>
        <SampleTag catalog={cat} />
      </div>
      <nav className={s.tabs} aria-label="Films or series">
        <Link href="/shelves" aria-current={kind === "movie" ? "page" : undefined} data-autofocus={kind === "movie" ? true : undefined} replace>Films <small>{count("movie")}</small></Link>
        <Link href="/shelves?kind=series" aria-current={kind === "series" ? "page" : undefined} data-autofocus={kind === "series" ? true : undefined} replace>Series <small>{count("series")}</small></Link>
        <Link href={`/library${kind === "series" ? "?kind=series" : ""}`} className={s.tabSide}>Whole library A to Z ▸</Link>
      </nav>
      {!lib.length && (
        <p style={{ color: "var(--muted)" }}>
          No {kind === "series" ? "series" : "films"} on the shelves yet. <Link href="/search">Find one in the Returns Slot</Link> or connect Plex on the Membership card.
        </p>
      )}
      {rows.map(({ g, titles }) => (
        <section key={g} className={s.aisle} aria-labelledby={`sign-${g}`}>
          <div className={s.signWrap}><h2 id={`sign-${g}`} className={s.sign} style={{ "--sc": SIGN[g] ?? "var(--lav)" } as React.CSSProperties}>{g}</h2></div>
          <div className={s.rack}>
            <div className={s.row}>
              {titles.map((t, i) => (
                <Link key={t.id} href={`/title/${t.id}`} className={s.slot} aria-label={`${t.t}, ${t.y}`} >
                  <span className={s.boxWrap}><VhsBox title={t} art={artOf(cat, t.id)} width={190} wear={(["rented", "loved", "mint", "rented"] as const)[i % 4]} edition={cat.editions[t.id]} /></span>
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
