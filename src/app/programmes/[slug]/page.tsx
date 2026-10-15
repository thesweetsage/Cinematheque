import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { VhsBox } from "@/components/VhsBox";
import { SampleTag } from "@/components/SampleTag";
import { artOf, findTitle, getCatalog, type Catalog } from "@/lib/catalog";
import { canWriteEssay } from "@/lib/editionEssay";
import { findProgramme, getProgrammes, spineLabel, stamps, TYPE_NAME, type Programme } from "@/lib/programmes";
import { AwardForm, EssayEditor, Editor, PairToggles, PrintButton, RemoveAward } from "../client";
import { Flyer, Poster, RentalCard, span, TapeRow } from "../parts";
import s from "../programmes.module.css";

export async function generateStaticParams() {
  return (await getProgrammes()).list.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = findProgramme(await getProgrammes(), (await params).slug);
  return { title: p ? `${p.type === "edition" ? spineLabel(p.spine) : p.title} · The Cinematheque` : "Not found" };
}

/* One programme: a festival (poster, booklet, schedule, awards), a 31 Days rental card, or an edition. */
export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [cat, progs] = await Promise.all([getCatalog(), getProgrammes()]);
  const p = findProgramme(progs, slug);
  if (!p) notFound();
  const live = progs.source === "db";
  const editable = live && p.type !== "edition" ? (
    <Editor
      p={{ slug: p.slug, type: p.type, title: p.title, theme: p.theme, essay: p.essay, start: p.start, end: p.end, accent: p.accent, status: p.status, items: p.items.map(({ position, id, date, note }) => ({ position, id, date, note })) }}
      titles={cat.titles.map((t) => ({ id: t.id, t: t.t, y: t.y, lib: t.lib }))}
    />
  ) : null;
  return (
    <>
      <div className={s.head}>
        <div className="osd-label"><Link href="/programmes">Festival wall</Link> · {TYPE_NAME[p.type]}{p.status !== "live" ? ` · ${p.status === "archived" ? "taken down" : "draft"}` : ""}</div>
        <SampleTag catalog={cat} />
      </div>
      {p.type === "festival" && <Festival p={p} cat={cat} live={live} today={progs.today} />}
      {p.type === "days31" && <Days31 p={p} cat={cat} today={progs.today} />}
      {p.type === "edition" && <Edition p={p} cat={cat} live={live} others={progs.list.filter((x) => x.type === "edition" && x.slug !== p.slug && x.status !== "draft")} />}
      {editable}
    </>
  );
}

function Festival({ p, cat, live, today }: { p: Programme; cat: Catalog; live: boolean; today: string }) {
  const ended = !!p.end && p.end < today;
  const options = p.items.map((it) => findTitle(cat, it.id)).filter((t) => !!t).map((t) => ({ id: t.id, t: t.t }));
  return (
    <>
      <section className={s.wall}>
        <Poster p={p} cat={cat} big />
        <div className={s.wallSide}>
          <h1 className={s.h1}>{p.title}</h1>
          <p className={s.muted}>{span(p)}</p>
          <Flyer p={p} cat={cat} live={live} focus />
        </div>
      </section>
      {(p.essay || p.theme) && (
        <section className={s.booklet} aria-label="Programme booklet">
          <div className={s.bookletKicker}>Programme notes</div>
          <h2 className={s.bookletTitle}>{p.title}</h2>
          {(p.essay || p.theme)!.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
        </section>
      )}
      <section className={s.section} aria-labelledby="jury">
        <h2 id="jury" className="sec-title">Jury awards</h2>
        {!ended && !p.awards.length && <p className={s.muted}>The jury meets after closing night{p.end ? ` (${span({ ...p, start: p.end, end: undefined })})` : ""}.</p>}
        {p.awards.length > 0 && (
          <ul className={s.awards}>
            {p.awards.map((a) => {
              const t = a.id ? findTitle(cat, a.id) : undefined;
              return (
                <li key={a.category} style={{ "--acc": p.accent } as CSSProperties}>
                  <span className={s.laurel}>{a.category}</span>
                  {t ? <Link href={`/title/${t.id}`} className={s.winner}>{t.t}</Link> : <span className={s.winner}>No winner</span>}
                  {a.note && <em>{a.note}</em>}
                  {live && <RemoveAward slug={p.slug} category={a.category} />}
                </li>
              );
            })}
          </ul>
        )}
        {live && ended && options.length > 0 && <AwardForm slug={p.slug} options={options} awards={p.awards} />}
      </section>
    </>
  );
}

function Days31({ p, cat, today }: { p: Programme; cat: Catalog; today: string }) {
  const { stamped } = stamps(p, today);
  const over = (!!p.end && p.end < today) || stamped >= 31;
  const seen = p.items.filter((i) => i.done).sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? ""));
  const next = p.items.filter((i) => !i.done);
  return (
    <>
      <h1 className={s.h1}>{p.title}</h1>
      {p.theme && <p className={s.lede}>{p.theme}</p>}
      <div className={s.cardWrap}><RentalCard p={p} cat={cat} today={today} /></div>
      {next.length > 0 && (
        <section className={s.section} aria-labelledby="upnext">
          <h2 id="upnext" className="sec-title">Up next</h2>
          <p className={s.muted}>Watched on Plex, a title stamps today&apos;s box by itself.</p>
          <TapeRow cat={cat} width={120} ids={next.map((it) => ({ id: it.id, href: `/title/${it.id}` }))} />
        </section>
      )}
      {over && (
        <section className={s.section} aria-labelledby="endposter">
          <div className={s.sectionHead}><h2 id="endposter" className="sec-title">The end poster</h2><PrintButton /></div>
          <div className={s.endPoster} style={{ "--acc": p.accent } as CSSProperties} data-print>
            <span className={s.posterKicker}>The Cinematheque presents</span>
            <span className={s.posterTitle}>{p.title}</span>
            <span className={s.endScore}>{stamped} of 31 nights</span>
            <div className={s.endGrid}>
              {seen.map((it) => {
                const t = findTitle(cat, it.id);
                const poster = t && artOf(cat, t.id).poster;
                return t && <span key={it.position} className={s.endCell} style={poster ? { backgroundImage: `url(${poster})` } : undefined}>{!poster && t.t}</span>;
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Edition({ p, cat, live, others }: { p: Programme; cat: Catalog; live: boolean; others: Programme[] }) {
  const t = p.items[0] && findTitle(cat, p.items[0].id);
  if (!t) notFound();
  const no = String(p.spine ?? "").padStart(3, "0");
  const pairs = others.filter((o) => p.pairs.includes(o.slug));
  return (
    <>
      <section className={s.edition}>
        <div className={s.editionBox}><VhsBox title={t} art={artOf(cat, t.id)} width={260} edition={no} kase="clam" wear="mint" view="front" /></div>
        <div>
          <div className={s.spineNo}>{spineLabel(p.spine)}</div>
          <h1 className={s.h1}>{t.t}</h1>
          <p className={s.muted}>{t.y || ""}{t.dir ? ` · ${t.dir}` : ""}</p>
          <div className={s.btns}><Link className="btn" href={`/title/${t.id}`} data-autofocus>Open the box</Link></div>
        </div>
      </section>
      <section className={s.booklet} aria-label="Edition essay">
        <div className={s.bookletKicker}>{spineLabel(p.spine)} · The essay{p.essay && p.essayDraft ? " · Draft" : ""}</div>
        <h2 className={s.bookletTitle}>{t.t}</h2>
        {p.essay ? p.essay.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)
          : <p className={s.bookletEmpty}>No essay yet. What it is, why it matters, what to notice, and your take: 400 to 600 words.</p>}
        {p.essay && p.essayDraft && <p className={s.draftNote}>Draft: read it against the sources, edit it, then mark it checked.</p>}
      </section>
      {live && <EssayEditor slug={p.slug} essay={p.essay ?? ""} draft={p.essayDraft} canWrite={canWriteEssay()} />}
      <section className={s.section} aria-labelledby="pairs">
        <h2 id="pairs" className="sec-title">Pairs with</h2>
        {pairs.length > 0 && <TapeRow cat={cat} width={120} ids={pairs.map((o) => ({ id: o.items[0]?.id, href: `/programmes/${o.slug}`, edition: String(o.spine ?? "").padStart(3, "0") })).filter((x) => x.id)} />}
        {!pairs.length && !live && <p className={s.muted}>No pairings yet.</p>}
        {live && <PairToggles slug={p.slug} others={others.map((o) => ({ slug: o.slug, label: `${spineLabel(o.spine)} ${findTitle(cat, o.items[0]?.id ?? "")?.t ?? o.title}`, on: p.pairs.includes(o.slug) }))} />}
      </section>
    </>
  );
}
