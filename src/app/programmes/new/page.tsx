import Link from "next/link";
import { getCatalog, shelf, aisles } from "@/lib/catalog";
import { getProgrammes } from "@/lib/programmes";
import { AutoProgrammeForm, NewProgrammeForm } from "../client";
import s from "../programmes.module.css";

export const metadata = { title: "Start a programme · The Cinematheque" };

/*
 * Start a festival or a 31 Days: one button builds it from the shelves (genre, decade, a typed theme, or a surprise).
 * Building one by hand is still there, below.
 */
export default async function NewProgramme() {
  const [{ source, today }, cat] = await Promise.all([getProgrammes(), getCatalog()]);
  const d = new Date(`${today}T12:00:00`);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toLocaleDateString("en-CA");
  const lib = shelf(cat);
  const genres = aisles(lib).map((a) => ({ g: a.g, n: a.titles.length })).filter((a) => a.n >= 4);
  const decadeCount = new Map<string, number>();
  for (const t of lib) if (t.y) { const k = `${String(Math.floor(t.y / 10) * 10).slice(2)}s`; decadeCount.set(k, (decadeCount.get(k) ?? 0) + 1); }
  const decades = [...decadeCount].filter(([, n]) => n >= 8).map(([k]) => k).sort((a, b) => (a < "30s" ? `1${a}` : a).localeCompare(b < "30s" ? `1${b}` : b));
  return (
    <div className={s.narrow}>
      <div className="osd-label">Programmes</div>
      <h1 className={s.h1}>Start a programme</h1>
      {source === "db" ? (
        <>
          <AutoProgrammeForm genres={genres} decades={decades} curator={!!process.env.ANTHROPIC_API_KEY} />
          <details className={s.byHand}>
            <summary tabIndex={0}>Or build one by hand</summary>
            <NewProgrammeForm today={today} monthEnd={monthEnd} />
          </details>
        </>
      ) : <p className={s.lede}>Programmes are saved in the database, so connect it first (see the README). <Link href="/programmes" data-autofocus>Back to the festival wall</Link>.</p>}
    </div>
  );
}
