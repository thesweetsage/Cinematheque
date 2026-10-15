import Link from "next/link";
import { getProgrammes } from "@/lib/programmes";
import { NewProgrammeForm } from "../client";
import s from "../programmes.module.css";

export const metadata = { title: "Start a programme · The Cinematheque" };

/* Start a festival or a 31 Days of ___: name, theme, dates and a colour. Titles are added on the next page. */
export default async function NewProgramme() {
  const { source, today } = await getProgrammes();
  const d = new Date(`${today}T12:00:00`);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toLocaleDateString("en-CA");
  return (
    <div className={s.narrow}>
      <div className="osd-label">Programmes</div>
      <h1 className={s.h1}>Start a programme</h1>
      {source === "db" ? <NewProgrammeForm today={today} monthEnd={monthEnd} />
        : <p className={s.lede}>Programmes are saved in the database, so connect it first (see the README). <Link href="/programmes" data-autofocus>Back to the festival wall</Link>.</p>}
    </div>
  );
}
