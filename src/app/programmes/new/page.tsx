import Link from "next/link";
import { DECADES, decadeLabel, GENRES } from "@/lib/autoProgramme";
import { getProgrammes } from "@/lib/programmes";
import { AutoProgrammeForm, NewProgrammeForm } from "../client";
import s from "../programmes.module.css";

export const metadata = { title: "Start a programme · The Cinematheque" };

/*
 * Start a festival or a 31 Days: it builds itself from TMDB (genre, decade, a typed theme, or a surprise).
 * Building one by hand is still there, below.
 */
export default async function NewProgramme() {
  const { source, today } = await getProgrammes();
  const d = new Date(`${today}T12:00:00`);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toLocaleDateString("en-CA");
  return (
    <div className={s.narrow}>
      <div className="osd-label">Programmes</div>
      <h1 className={s.h1}>Start a programme</h1>
      {source === "db" ? (
        <>
          <AutoProgrammeForm genres={GENRES.map(({ key, label }) => ({ key, label }))} decades={DECADES.map((v) => ({ value: v, label: `The ${decadeLabel(v)}` }))} curator={!!process.env.ANTHROPIC_API_KEY} />
          <details className={s.byHand}>
            <summary tabIndex={0}>Or build one by hand</summary>
            <NewProgrammeForm today={today} monthEnd={monthEnd} />
          </details>
        </>
      ) : <p className={s.lede}>Programmes are saved in the database, so connect it first (see the README). <Link href="/programmes" data-autofocus>Back to the festival wall</Link>.</p>}
    </div>
  );
}
