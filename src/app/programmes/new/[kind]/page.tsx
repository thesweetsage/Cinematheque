import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { getProgrammes } from "@/lib/programmes";
import { CurriculumForm, MarathonForm, type PickTitle } from "../forms";
import { KINDS } from "../kinds";
import s from "../../programmes.module.css";

/* Start one of the v2 programmes: each kind has its own short form. */

export function generateStaticParams() { return Object.keys(KINDS).map((kind) => ({ kind })); }

export default async function NewKind({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { kind } = await params;
  const k = KINDS[kind];
  if (!k) notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const [cat, progs] = await Promise.all([getCatalog(), getProgrammes()]);
  const pick = (kind: "movie" | "series"): PickTitle[] => cat.titles.filter((t) => t.kind === kind).map((t) => ({ id: t.id, t: t.t, y: t.y, lib: t.lib, plex: t.plex }));
  return (
    <div className={s.narrow}>
      <div className="osd-label"><Link href="/programmes/new">Start a programme</Link></div>
      <h1 className={s.h1}>{k.title}</h1>
      <p className={s.lede}>{k.lede}</p>
      {progs.source !== "db" ? <p className={s.lede}>Programmes are saved in the database, so connect it first (see the README).</p>
        : kind === "marathon" ? <MarathonForm series={pick("series")} preset={one(sp.series)} today={progs.today} />
        : kind === "curriculum" ? <CurriculumForm curator={!!process.env.ANTHROPIC_API_KEY} />
        : null}
    </div>
  );
}
