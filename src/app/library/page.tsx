import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { artOf, getCatalog, shelf, type Title } from "@/lib/catalog";
import s from "./library.module.css";

export const metadata = { title: "The Library · The Cinematheque" };

const PAGE = 40;
type Sort = "az" | "recent" | "year";
const SORTS: [Sort, string][] = [["az", "A to Z"], ["recent", "Newest in"], ["year", "By year"]];

/*
 * The whole library: every film (or every series) on the shelves in one place, A to Z, newest in, or by year,
 * narrowed to one genre if wanted. Every control is a plain link, so the remote moves through it with the arrows
 * and OK; 40 tapes a page keeps it light on the TV box.
 */
export default async function Library({ searchParams }: { searchParams: Promise<{ kind?: string; sort?: string; genre?: string; page?: string }> }) {
  const q = await searchParams;
  const kind = q.kind === "series" ? "series" : "movie";
  const sort: Sort = q.sort === "recent" || q.sort === "year" ? q.sort : "az";
  const cat = await getCatalog();
  const all = shelf(cat);
  const ofKind = all.filter((t) => t.kind === kind);
  const genresOf = (t: Title) => t.gs?.length ? t.gs : [t.g.charAt(0) + t.g.slice(1).toLowerCase()];
  const counts = new Map<string, number>();
  for (const t of ofKind) for (const g of genresOf(t)) counts.set(g, (counts.get(g) ?? 0) + 1);
  const genres = [...counts].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  const genre = q.genre && counts.has(q.genre) ? q.genre : null;

  const name = (t: Title) => t.t.replace(/^(the|a|an) /i, "");
  const list = (genre ? ofKind.filter((t) => genresOf(t).includes(genre)) : ofKind).sort(
    sort === "recent" ? (a, b) => (b.added ?? "").localeCompare(a.added ?? "") || name(a).localeCompare(name(b))
      : sort === "year" ? (a, b) => (b.y || 0) - (a.y || 0) || name(a).localeCompare(name(b))
        : (a, b) => name(a).localeCompare(name(b)),
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(q.page) || 1));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);

  const href = (o: { kind?: string; sort?: Sort; genre?: string | null; page?: number }) => {
    const p = new URLSearchParams();
    const k = o.kind ?? kind, so = o.sort ?? sort, g = o.genre === undefined ? genre : o.genre, pg = o.page ?? 1;
    if (k === "series") p.set("kind", "series");
    if (so !== "az") p.set("sort", so);
    if (g) p.set("genre", g);
    if (pg > 1) p.set("page", String(pg));
    const str = p.toString();
    return `/library${str ? `?${str}` : ""}`;
  };
  const letter = (t: Title) => (sort === "az" ? name(t).charAt(0).toUpperCase().replace(/[^A-Z]/, "#") : sort === "year" ? String(t.y || "?") : null);

  return (
    <>
      <div className={s.head}>
        <div><div className="osd-label">{list.length} {kind === "series" ? "series" : "films"}{genre ? ` · ${genre}` : ""}</div><h1 className={s.h1}>The library</h1></div>
        <SampleTag catalog={cat} />
      </div>
      <nav className={s.tabs} aria-label="Films or series">
        <Link href={href({ kind: "movie", genre: null })} aria-current={kind === "movie" ? "page" : undefined} data-autofocus={kind === "movie" ? true : undefined} replace>Films <small>{all.filter((t) => t.kind === "movie").length}</small></Link>
        <Link href={href({ kind: "series", genre: null })} aria-current={kind === "series" ? "page" : undefined} data-autofocus={kind === "series" ? true : undefined} replace>Series <small>{all.filter((t) => t.kind === "series").length}</small></Link>
      </nav>
      <div className={s.bar} role="group" aria-label="Sort">
        <span className={s.barLabel}>Sort</span>
        {SORTS.map(([k, label]) => <Link key={k} href={href({ sort: k })} className={s.pill} aria-current={sort === k ? "true" : undefined} replace>{label}</Link>)}
      </div>
      {genres.length > 1 && (
        <div className={s.bar} role="group" aria-label="Genre">
          <span className={s.barLabel}>Genre</span>
          <Link href={href({ genre: null })} className={s.pill} aria-current={!genre ? "true" : undefined} replace>All</Link>
          {genres.map((g) => <Link key={g} href={href({ genre: g })} className={s.pill} aria-current={genre === g ? "true" : undefined} replace>{g} <small>{counts.get(g)}</small></Link>)}
        </div>
      )}
      {!list.length && <p className={s.empty}>Nothing here yet. Connect Plex on the Membership card, or add titles in the Returns Slot.</p>}
      <ol className={s.grid}>
        {shown.map((t, i) => {
          const l = letter(t), prev = i > 0 ? letter(shown[i - 1]) : null;
          return (
            <li key={t.id} className={s.cell}>
              {l && l !== prev && <span className={s.letter} aria-hidden="true">{l}</span>}
              <Link href={`/title/${t.id}`} className={s.slot} aria-label={`${t.t}${t.y ? `, ${t.y}` : ""}${t.plex ? ", on Plex" : ""}`}>
                <span className={s.box}><VhsBox title={t} art={artOf(cat, t.id)} width={130} wear="mint" edition={cat.editions[t.id]} /></span>
                <span className={s.cap}>{t.t}<small>{t.y || ""}</small></span>
              </Link>
            </li>
          );
        })}
      </ol>
      {pages > 1 && (
        <nav className={s.pager} aria-label="Pages">
          {page > 1 ? <Link className="btn" href={href({ page: page - 1 })}>◂ Page {page - 1}</Link> : <span />}
          <span className={s.pageNo}>Page {page} of {pages}</span>
          {page < pages ? <Link className="btn primary" href={href({ page: page + 1 })}>Page {page + 1} ▸</Link> : <span />}
        </nav>
      )}
    </>
  );
}
