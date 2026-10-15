import type { Fact } from "@/lib/catalog";
import type { Notes } from "@/lib/titleExtras";
import { BookletActions } from "./BookletActions";
import s from "./booklet.module.css";

type Props = {
  slug: string; title: string;
  /** Notes from the database, or the sample set's cards. */
  notes: Notes | null; sampleCards?: Fact[];
  /** Database titles only: whether Claude can write (API key set). */
  live: boolean; canWrite: boolean;
};

const articleName = (url: string) => decodeURIComponent(url.split("/wiki/")[1]?.split(/[?#]/)[0] ?? "").replace(/_/g, " ");

/* Fact cards and liner notes, in the same store look as the rest of the title page; a draft until the member checks it. */
export function Booklet({ slug, title, notes, sampleCards, live, canWrite }: Props) {
  const cards = notes?.cards.map((c) => ({ label: c.label, text: c.text, source: c.source as string | undefined }))
    ?? sampleCards?.map((c) => ({ label: c.k, text: c.x, source: undefined }));
  const writing = live && !notes && canWrite;
  if (!cards?.length && !writing) {
    return live ? <p className={s.off}>Liner notes are written from Wikipedia by Claude once <code>ANTHROPIC_API_KEY</code> is set in .env.local.</p> : null;
  }
  const source = notes?.sources[0];
  return (
    <section className={s.notes} aria-labelledby="booklet-h">
      {cards && cards.length > 0 && (
        <>
          <div className={s.head}>
            <h2 id="booklet-h" className="sec-title">Did you know?</h2>
            {notes?.draft && <span className={s.draft}>Draft · not checked yet</span>}
          </div>
          <ol className={s.cards}>
            {cards.map((c, i) => (
              <li key={i} className={s.card}>
                <span className={s.label}>{String(i + 1).padStart(2, "0")} · {c.label}</span>
                <p>{c.text}</p>
                {c.source && <a className={s.src} href={c.source} target="_blank" rel="noreferrer" tabIndex={-1}>Source ▸</a>}
              </li>
            ))}
          </ol>
        </>
      )}
      {!cards?.length && <h2 id="booklet-h" className="sec-title">Liner notes</h2>}
      {notes?.liner && (
        <div className={s.liner}>
          <h3 className={s.linerHead}>Liner notes</h3>
          <div className={s.text}>{notes.liner.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
        </div>
      )}
      {live && (
        <footer className={s.foot}>
          {source && <p className={s.credit}>From the Wikipedia article <a href={source} target="_blank" rel="noreferrer" tabIndex={-1}>{articleName(source)}</a> (CC BY-SA 4.0), written up by Claude. Check it against the article before marking it checked.</p>}
          <BookletActions slug={slug} hasNotes={!!notes} draft={!!notes?.draft} canWrite={canWrite} autoWrite={writing} />
        </footer>
      )}
    </section>
  );
}
