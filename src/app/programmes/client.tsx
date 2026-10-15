"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProgStatus } from "@/lib/programmes";
import {
  addItem, createProgramme, deleteProgramme, draftEssay, induct, moveItem, removeItem, saveEssay, setAward, setDone, setPair, setStatus, updateDetails, updateItem,
} from "./actions";
import s from "./programmes.module.css";

/* The parts of the festival wall you can press: tick boxes, the programme editor, awards, the edition essay. */

type Res = { error?: string };
/** Runs a server action, shows its error, and refreshes the page on success. */
function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<Res>, then?: () => void) => start(async () => {
    setError("");
    const r = await fn().catch((e: Error) => ({ error: e.message }));
    if (r.error) setError(r.error); else { then?.(); router.refresh(); }
  });
  return { pending, error, run };
}
const Err = ({ msg }: { msg: string }) => (msg ? <p className={s.err} role="alert">{msg}</p> : null);

/** A pen-drawn tick box. In the sample set it only shows the state. */
export function TickBox({ slug, position, done, title, live }: { slug: string; position: number; done: boolean; title: string; live: boolean }) {
  const { pending, error, run } = useAct();
  const [on, setOn] = useState(done);
  if (!live) return <span className={s.tick} data-on={on} aria-label={on ? "Seen" : "Not seen yet"} role="img" />;
  return (
    <span className={s.tickWrap}>
      <button className={s.tick} data-on={on} role="checkbox" aria-checked={on} aria-label={`${title}: ${on ? "seen" : "not seen yet"}`} disabled={pending}
        onClick={() => run(() => setDone(slug, position, !on), () => setOn(!on))} />
      {error && <span className={s.err} role="alert">{error}</span>}
    </span>
  );
}

const ACCENTS = ["#FF4FB8", "#7EE6FF", "#FFE38A", "#FF9A5C", "#B9B2FF", "#7CFF9E"];
const ACCENT_NAMES: Record<string, string> = { "#FF4FB8": "Magenta", "#7EE6FF": "Cyan", "#FFE38A": "Yellow", "#FF9A5C": "Orange", "#B9B2FF": "Lavender", "#7CFF9E": "Green" };

function Accents({ value }: { value: string }) {
  return (
    <fieldset className={s.accents}>
      <legend>Colour</legend>
      {ACCENTS.map((c) => (
        <label key={c} className={s.swatch} style={{ background: c }}>
          <input type="radio" name="accent" value={c} defaultChecked={c === value} aria-label={ACCENT_NAMES[c]} />
        </label>
      ))}
    </fieldset>
  );
}

/** Start a festival or a 31 Days. */
export function NewProgrammeForm({ today, monthEnd }: { today: string; monthEnd: string }) {
  const router = useRouter();
  const [type, setType] = useState<"festival" | "days31">("festival");
  const [start, setStart] = useState(today);
  const [error, setError] = useState("");
  const [pending, go] = useTransition();
  const end31 = (() => { const d = new Date(`${start}T12:00:00`); d.setDate(d.getDate() + 30); return d.toLocaleDateString("en-CA"); })();
  const submit = (form: FormData) => go(async () => {
    setError("");
    const r = await createProgramme(form);
    if (r.error) setError(r.error); else router.push(`/programmes/${r.slug}`);
  });
  return (
    <form className={s.form} action={submit}>
      <fieldset className={s.choice}>
        <legend>What kind</legend>
        {(["festival", "days31"] as const).map((k) => (
          <label key={k} className={s.option} data-on={type === k}>
            <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} data-autofocus={k === "festival" ? true : undefined} />
            <b>{k === "festival" ? "Festival" : "31 Days of ___"}</b>
            <span>{k === "festival" ? "A curated programme of 6 to 12 titles on any theme, with a booklet, a schedule and jury awards at the end." : "One title a day for 31 days on any theme. A rental card with a stamp for every day and a streak."}</span>
          </label>
        ))}
      </fieldset>
      <label className={s.field}><span>Name</span><input name="title" required maxLength={120} placeholder={type === "festival" ? "Isolation" : "31 Days of Rom-Coms"} /></label>
      <label className={s.field}><span>Theme</span><textarea name="theme" rows={2} maxLength={600} placeholder="What ties it together, in a sentence or two" /></label>
      <div className={s.dates}>
        <label className={s.field}><span>Starts</span><input type="date" name="start" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
        <label className={s.field} key={type}><span>Ends</span><input type="date" name="end" defaultValue={type === "days31" ? end31 : monthEnd} required /></label>
      </div>
      <Accents value={type === "festival" ? "#7EE6FF" : "#FF4FB8"} />
      <Err msg={error} />
      <div className={s.btns}><button className="btn primary" disabled={pending}>{pending ? "Printing…" : "Print the poster"}</button></div>
    </form>
  );
}

type PickTitle = { id: string; t: string; y: number; lib: boolean };
type EditItem = { position: number; id: string; date?: string; note?: string };
type EditProgramme = { slug: string; type: string; title: string; theme?: string; essay?: string; start?: string; end?: string; accent: string; status: ProgStatus; items: EditItem[] };

/** The programme editor: details, the titles (dates, notes, order), adding titles, and the programme's status. */
export function Editor({ p, titles }: { p: EditProgramme; titles: PickTitle[] }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAct();
  const router = useRouter();
  const name = useMemo(() => new Map(titles.map((t) => [t.id, `${t.t}${t.y ? ` (${t.y})` : ""}`])), [titles]);
  if (!open) return <div className={s.btns}><button className="btn" onClick={() => setOpen(true)}>Edit programme</button></div>;
  return (
    <section className={s.editor} aria-label="Edit programme">
      <div className={s.editorHead}><h2 className={s.h2}>Edit programme</h2><button className="btn" onClick={() => setOpen(false)}>Done</button></div>
      <form className={s.form} action={(f) => run(() => updateDetails(p.slug, f))}>
        <label className={s.field}><span>Name</span><input name="title" defaultValue={p.title} required maxLength={120} /></label>
        <label className={s.field}><span>Theme</span><textarea name="theme" rows={2} defaultValue={p.theme} maxLength={600} /></label>
        {p.type === "festival" && <label className={s.field}><span>Booklet</span><textarea name="essay" rows={6} defaultValue={p.essay} maxLength={12000} placeholder="The programme notes: why these titles, in this order." /></label>}
        <div className={s.dates}>
          <label className={s.field}><span>Starts</span><input type="date" name="start" defaultValue={p.start} /></label>
          <label className={s.field}><span>Ends</span><input type="date" name="end" defaultValue={p.end} /></label>
        </div>
        <Accents value={p.accent} />
        <div className={s.btns}><button className="btn primary" disabled={pending}>Save details</button></div>
      </form>

      <h3 className={s.h3}>On the bill</h3>
      {!p.items.length && <p className={s.muted}>No titles yet. Add some below.</p>}
      <ol className={s.editList}>
        {p.items.map((it, i) => <ItemRow key={it.position} slug={p.slug} it={it} label={name.get(it.id) ?? it.id} first={i === 0} last={i === p.items.length - 1} dated={p.type === "festival"} />)}
      </ol>
      <Picker titles={titles} taken={new Set(p.items.map((i) => i.id))} onAdd={(id) => run(() => addItem(p.slug, id))} pending={pending} />

      <h3 className={s.h3}>Status</h3>
      <div className={s.btns}>
        {p.status !== "live" && <button className="btn" disabled={pending} onClick={() => run(() => setStatus(p.slug, "live"))}>Put it on the wall</button>}
        {p.status !== "archived" && <button className="btn" disabled={pending} onClick={() => run(() => setStatus(p.slug, "archived"))}>Take it down (archive)</button>}
        <button className="btn" disabled={pending} onClick={() => { if (confirm(`Throw away ${p.title}? Its ticks and awards go too.`)) run(() => deleteProgramme(p.slug), () => router.push("/programmes")); }}>Throw it away</button>
      </div>
      <Err msg={error} />
    </section>
  );
}

function ItemRow({ slug, it, label, first, last, dated }: { slug: string; it: EditItem; label: string; first: boolean; last: boolean; dated: boolean }) {
  const { pending, error, run } = useAct();
  const [date, setDate] = useState(it.date ?? "");
  const [note, setNote] = useState(it.note ?? "");
  const dirty = date !== (it.date ?? "") || note !== (it.note ?? "");
  return (
    <li className={s.editRow}>
      <span className={s.editName}>{label}</span>
      {dated && <input type="date" aria-label={`Date for ${label}`} value={date} onChange={(e) => setDate(e.target.value)} />}
      <input aria-label={`Note for ${label}`} placeholder="Programme note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      <span className={s.rowBtns}>
        {dirty && <button className={s.small} disabled={pending} onClick={() => run(() => updateItem(slug, it.position, date || null, note || null))}>Save</button>}
        <button className={s.small} disabled={pending || first} aria-label={`Move ${label} up`} onClick={() => run(() => moveItem(slug, it.position, -1))}>▲</button>
        <button className={s.small} disabled={pending || last} aria-label={`Move ${label} down`} onClick={() => run(() => moveItem(slug, it.position, 1))}>▼</button>
        <button className={s.small} disabled={pending} aria-label={`Remove ${label}`} onClick={() => run(() => removeItem(slug, it.position))}>✕</button>
      </span>
      <Err msg={error} />
    </li>
  );
}

/** Find a title in the store by name and add it. Shelf titles first. */
function Picker({ titles, taken, onAdd, pending }: { titles: PickTitle[]; taken: Set<string>; onAdd: (id: string) => void; pending: boolean }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return titles.filter((t) => !taken.has(t.id) && (t.t.toLowerCase().includes(n) || String(t.y) === n))
      .sort((a, b) => Number(b.lib) - Number(a.lib) || a.t.localeCompare(b.t)).slice(0, 18);
  }, [q, titles, taken]);
  return (
    <div className={s.picker}>
      <label className={s.field}><span>Add a title from the store</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type part of a title or a year" autoComplete="off" /></label>
      {q.trim() && !hits.length && <p className={s.muted}>Nothing in the store matches. Find it in the Returns Slot first.</p>}
      <div className={s.hits}>
        {hits.map((t) => <button key={t.id} className={s.hit} disabled={pending} onClick={() => onAdd(t.id)}>+ {t.t} <small>{t.y || ""}{t.lib ? "" : " · not on the shelves"}</small></button>)}
      </div>
    </div>
  );
}

/** Jury awards, after the festival ends: one winner per category from the programme's titles. */
export function AwardForm({ slug, options, awards }: { slug: string; options: { id: string; t: string }[]; awards: { category: string; id?: string; note?: string }[] }) {
  const { pending, error, run } = useAct();
  const suggestions = ["Best Film", "Best Performance", "Best Scene", "Best Score", "Audience Award"].filter((c) => !awards.some((a) => a.category === c));
  return (
    <form className={s.awardForm} action={(f) => run(() => setAward(slug, String(f.get("category")), String(f.get("title")) || null, String(f.get("note") ?? "")))}>
      <label className={s.field}><span>Award</span><input name="category" list="award-cats" defaultValue={suggestions[0] ?? ""} required maxLength={60} /></label>
      <datalist id="award-cats">{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
      <label className={s.field}><span>Goes to</span>
        <select name="title" required defaultValue="">
          <option value="" disabled>Choose a title</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.t}</option>)}
        </select>
      </label>
      <label className={s.field}><span>Citation</span><input name="note" maxLength={200} placeholder="One line from the jury" /></label>
      <div className={s.btns}><button className="btn primary" disabled={pending}>Hand it out</button></div>
      <Err msg={error} />
    </form>
  );
}

export function RemoveAward({ slug, category }: { slug: string; category: string }) {
  const { pending, error, run } = useAct();
  return <>{" "}<button className={s.small} disabled={pending} aria-label={`Take back ${category}`} onClick={() => run(() => setAward(slug, category, null, ""))}>✕</button><Err msg={error} /></>;
}

/** The edition essay: write a draft with Claude, edit it, mark it checked. */
export function EssayEditor({ slug, essay, draft, canWrite }: { slug: string; essay: string; draft: boolean; canWrite: boolean }) {
  const { pending, error, run } = useAct();
  const [text, setText] = useState(essay);
  const [editing, setEditing] = useState(false);
  const [writing, setWriting] = useState(false);
  const write = () => { setWriting(true); run(() => draftEssay(slug).finally(() => setWriting(false))); };
  return (
    <div className={s.essayTools}>
      {writing && <p className={s.muted} role="status">Writing the essay from Wikipedia and your notes… about a minute.</p>}
      {editing ? (
        <>
          <label className={s.field}><span>Essay</span><textarea rows={16} value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} /></label>
          <div className={s.btns}>
            <button className="btn primary" disabled={pending} onClick={() => run(() => saveEssay(slug, text, false), () => setEditing(false))}>Save draft</button>
            <button className="btn" disabled={pending} onClick={() => run(() => saveEssay(slug, text, true), () => setEditing(false))}>Save and mark checked</button>
            <button className="btn" onClick={() => { setText(essay); setEditing(false); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className={s.btns}>
          <button className="btn" onClick={() => { setText(essay); setEditing(true); }}>{essay ? "Edit the essay" : "Write it yourself"}</button>
          {canWrite && <button className="btn" disabled={pending} onClick={write}>{essay ? "Redraft with Claude" : "Draft it with Claude"}</button>}
          {essay && draft && <button className="btn" disabled={pending} onClick={() => run(() => saveEssay(slug, essay, true))}>Mark as checked</button>}
          {essay && !draft && <button className="btn" disabled={pending} onClick={() => run(() => saveEssay(slug, essay, false))}>Back to draft</button>}
        </div>
      )}
      <Err msg={error} />
    </div>
  );
}

/** "Pairs with": toggle the other editions this one goes with. */
export function PairToggles({ slug, others }: { slug: string; others: { slug: string; label: string; on: boolean }[] }) {
  const { pending, error, run } = useAct();
  if (!others.length) return <p className={s.muted}>Induct more titles and they can be paired here.</p>;
  return (
    <div className={s.btns}>
      {others.map((o) => (
        <button key={o.slug} className={s.small} aria-pressed={o.on} disabled={pending} onClick={() => run(() => setPair(slug, o.slug, !o.on))}>{o.on ? "✓ " : "+ "}{o.label}</button>
      ))}
      <Err msg={error} />
    </div>
  );
}

/** On a title page: induct it into the collection. */
export function InductButton({ titleSlug, title }: { titleSlug: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const go = () => start(async () => {
    setError("");
    const r = await induct(titleSlug);
    if (r.error) setError(r.error); else router.push(`/programmes/${r.slug}`);
  });
  return (
    <>
      <button className="btn" onClick={go} disabled={pending} aria-label={`Induct ${title} into the collection`}>{pending ? "Numbering the spine…" : "★ Induct into the collection"}</button>
      {error && <p className={s.err} role="alert">{error}</p>}
    </>
  );
}

export function PrintButton() {
  return <button className="btn" onClick={() => window.print()}>Print the poster</button>;
}
