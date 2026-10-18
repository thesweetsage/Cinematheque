"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProgStatus } from "@/lib/programmes";
import {
  addItem, addLink, createProgramme, deleteProgramme, induct, moveItem, removeItem, removeLink, saveEssay, saveItemEssay, saveThemes, setAward, setCapsuleChecked,
  setDone, setLinkNote, setPair, setStatus, setTop10, syncToPlex, updateDetails, updateItem, verifyLink,
} from "./actions";
import { Chips, TitleChooser } from "./new/forms";
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

/**
 * Start a programme the easy way: Festival or 31 Days, then a genre and/or a decade (or a typed theme, or Surprise me)
 * and it builds itself from all of TMDB, with what's on your Plex mixed in. It runs as a plain request, not a
 * server action, so the menu and the rest of the page keep working while it builds (up to a minute).
 */
export function AutoProgrammeForm({ genres, decades, curator }: { genres: { key: string; label: string }[]; decades: { value: number; label: string }[]; curator: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<"festival" | "days31">("festival");
  const [genre, setGenre] = useState<string | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const build = async (body: { genre?: string | null; decade?: number | null; theme?: string | null }) => {
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/programmes/auto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, ...body }) });
      const out = (await r.json().catch(() => ({ error: `The server answered ${r.status}.` }))) as { slug?: string; error?: string };
      if (out.slug) { router.push(`/programmes/${out.slug}`); return; }
      setError(out.error ?? "Something went wrong.");
    } catch {
      setError("Lost the connection to the app. Is it still running?");
    }
    setBusy(false);
  };
  const toggle = <T,>(cur: T | null, v: T, set: (x: T | null) => void) => set(cur === v ? null : v);
  const what = [decade ? decades.find((d) => d.value === decade)?.label : null, genre ? genres.find((g) => g.key === genre)?.label : null].filter(Boolean).join(" ");
  return (
    <div className={s.form}>
      <div className={s.choice} role="radiogroup" aria-label="What kind">
        {(["festival", "days31"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={s.option} data-on={kind === k} onClick={() => setKind(k)} disabled={busy} data-autofocus={k === "festival" ? true : undefined}>
            <b>{k === "festival" ? "Festival" : "31 Days of ___"}</b>
            <span>{k === "festival" ? "About 8 films over four weeks, with a booklet, a schedule and jury awards at the end." : "One film a night for 31 nights, on a rental card with a stamp for every day and a streak."}</span>
          </button>
        ))}
      </div>
      <div>
        <div className={s.fieldLabel}>Genre</div>
        <div className={s.chips}>
          {genres.map((g) => <button key={g.key} type="button" className={s.chip} aria-pressed={genre === g.key} disabled={busy} onClick={() => toggle(genre, g.key, setGenre)}>{g.label}</button>)}
        </div>
      </div>
      <div>
        <div className={s.fieldLabel}>Decade (optional)</div>
        <div className={s.chips}>
          {decades.map((d) => <button key={d.value} type="button" className={s.chip} aria-pressed={decade === d.value} disabled={busy} onClick={() => toggle(decade, d.value, setDecade)}>{d.label}</button>)}
        </div>
      </div>
      <div className={s.btns}>
        <button type="button" className="btn primary" disabled={busy || (!genre && !decade)} onClick={() => build({ genre, decade })}>{what ? `Build ${kind === "days31" ? "31 Days of" : "a festival of"} ${what}` : "Pick a genre or a decade"}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => build({})}>Surprise me</button>
      </div>
      {curator && (
        <form className={s.themeRow} onSubmit={(e) => { e.preventDefault(); if (theme.trim()) build({ theme: theme.trim() }); }}>
          <label className={s.field}><span>Or any theme</span><input value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={200} placeholder="Folk horror, road movies, medieval, one country…" disabled={busy} /></label>
          <button className="btn" disabled={busy || !theme.trim()}>Build it</button>
        </form>
      )}
      {busy && <p className={s.status} role="status">Building it: finding films on TMDB{curator ? ", Claude is curating" : ""} and fetching their covers. This takes up to a minute; you can leave this page and it carries on.</p>}
      <Err msg={error} />
    </div>
  );
}

/** Start a festival or a 31 Days by hand. */
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
export function Editor({ p, titles, bill = true }: { p: EditProgramme; titles: PickTitle[]; bill?: boolean }) {
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
        {(p.type === "festival" || p.type === "time_capsule") && <label className={s.field}><span>Booklet</span><textarea name="essay" rows={6} defaultValue={p.essay} maxLength={12000} placeholder="The programme notes: why these titles, in this order." /></label>}
        <div className={s.dates}>
          <label className={s.field}><span>Starts</span><input type="date" name="start" defaultValue={p.start} /></label>
          <label className={s.field}><span>Ends</span><input type="date" name="end" defaultValue={p.end} /></label>
        </div>
        <Accents value={p.accent} />
        <div className={s.btns}><button className="btn primary" disabled={pending}>Save details</button></div>
      </form>

      {bill && (
        <>
          <h3 className={s.h3}>On the bill</h3>
          {!p.items.length && <p className={s.muted}>No titles yet. Add some below.</p>}
          <ol className={s.editList}>
            {p.items.map((it, i) => <ItemRow key={it.position} slug={p.slug} it={it} label={name.get(it.id) ?? it.id} first={i === 0} last={i === p.items.length - 1} dated={p.type === "festival" || p.type === "time_capsule"} />)}
          </ol>
          <Picker titles={titles} taken={new Set(p.items.map((i) => i.id))} onAdd={(id) => run(() => addItem(p.slug, id))} pending={pending} />
        </>
      )}

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
      <label className={s.field}><span>Add a film from the store</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type part of a title or a year" autoComplete="off" /></label>
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
  const router = useRouter();
  const [writeError, setWriteError] = useState("");
  // A plain request, not a server action: the page and menu stay usable during the minute Claude writes.
  const write = async () => {
    setWriting(true); setWriteError("");
    try {
      const r = await fetch("/api/essay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) });
      const out = (await r.json().catch(() => ({ error: `The server answered ${r.status}.` }))) as { error?: string };
      if (out.error) setWriteError(out.error); else router.refresh();
    } catch { setWriteError("Lost the connection to the app."); }
    setWriting(false);
  };
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
          {canWrite && <button className="btn" disabled={pending || writing} onClick={write}>{essay ? "Redraft with Claude" : "Draft it with Claude"}</button>}
          {essay && draft && <button className="btn" disabled={pending} onClick={() => run(() => saveEssay(slug, essay, true))}>Mark as checked</button>}
          {essay && !draft && <button className="btn" disabled={pending} onClick={() => run(() => saveEssay(slug, essay, false))}>Back to draft</button>}
        </div>
      )}
      <Err msg={error || writeError} />
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

/** Takes one title off a programme (a curriculum's wrong TMDB match, say). */
export function RemoveItem({ slug, position, label, text = "✕ Remove" }: { slug: string; position: number; label: string; text?: string }) {
  const { pending, error, run } = useAct();
  return <span>{" "}<button className={s.small} disabled={pending} aria-label={`Remove ${label}`} onClick={() => run(() => removeItem(slug, position))}>{text}</button><Err msg={error} /></span>;
}

/** Changes a programme's status (put a checked curriculum on the shelf, archive it). */
export function StatusButton({ slug, status, label, primary = false, autofocus = false }: { slug: string; status: ProgStatus; label: string; primary?: boolean; autofocus?: boolean }) {
  const { pending, error, run } = useAct();
  return <>{" "}<button className={primary ? "btn primary" : "btn"} disabled={pending} onClick={() => run(() => setStatus(slug, status))} data-autofocus={autofocus ? true : undefined}>{label}</button><Err msg={error} /></>;
}

/**
 * The Top 10 chalkboard: the films watched so far, best first. Move them with the arrows; the first ten are the
 * Top 10. Each move saves straight away.
 */
export function TopTen({ slug, films }: { slug: string; films: { id: string; t: string; y: number }[] }) {
  const { pending, error, run } = useAct();
  const [list, setList] = useState(films);
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setList(next);
    run(() => setTop10(slug, next.map((f) => f.id)));
  };
  return (
    <div className={s.chalk}>
      <div className={s.chalkTitle}>Top 10</div>
      <ol className={s.chalkList}>
        {list.map((f, i) => (
          <li key={f.id} className={i >= 10 ? s.chalkRest : undefined}>
            <span className={s.chalkNo}>{i < 10 ? i + 1 : "·"}</span>
            <span className={s.chalkName}>{f.t} <small>{f.y || ""}</small></span>
            <span className={s.rowBtns}>
              <button className={s.small} disabled={pending || i === 0} aria-label={`Move ${f.t} up`} onClick={() => move(i, -1)}>▲</button>
              <button className={s.small} disabled={pending || i === list.length - 1} aria-label={`Move ${f.t} down`} onClick={() => move(i, 1)}>▼</button>
            </span>
          </li>
        ))}
      </ol>
      <Err msg={error} />
    </div>
  );
}

/** The retrospective's "Themes to watch for" staff card: write it with Claude, edit it, mark it checked. */
export function ThemesTools({ slug, text, draft, canWrite }: { slug: string; text: string; draft: boolean; canWrite: boolean }) {
  const { pending, error, run } = useAct();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState("");
  const write = async () => {
    setWriting(true); setWriteError("");
    try {
      const r = await fetch("/api/programmes/themes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) });
      const out = (await r.json().catch(() => ({ error: `The server answered ${r.status}.` }))) as { error?: string };
      if (out.error) setWriteError(out.error); else router.refresh();
    } catch { setWriteError("Lost the connection to the app."); }
    setWriting(false);
  };
  return (
    <div className={s.essayTools}>
      {writing && <p className={s.muted} role="status">Writing the card from Wikipedia… under a minute.</p>}
      {editing ? (
        <>
          <label className={s.field}><span>Themes to watch for</span><textarea rows={7} value={value} onChange={(e) => setValue(e.target.value)} maxLength={3000} /></label>
          <div className={s.btns}>
            <button className="btn primary" disabled={pending} onClick={() => run(() => saveThemes(slug, value, false), () => setEditing(false))}>Save draft</button>
            <button className="btn" disabled={pending} onClick={() => run(() => saveThemes(slug, value, true), () => setEditing(false))}>Save and mark checked</button>
            <button className="btn" onClick={() => { setValue(text); setEditing(false); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className={s.btns}>
          <button className="btn" onClick={() => { setValue(text); setEditing(true); }}>{text ? "Edit the card" : "Write it yourself"}</button>
          {canWrite && <button className="btn" disabled={writing} onClick={write}>{text ? "Rewrite with Claude" : "Write it with Claude"}</button>}
          {text && draft && <button className="btn" disabled={pending} onClick={() => run(() => saveThemes(slug, text, true))}>Mark as checked</button>}
        </div>
      )}
      <Err msg={error || writeError} />
    </div>
  );
}

type Link = { from: string; to: string; kind: "inspired" | "influenced" };

/** One branch of a family tree: verify it, remove it, or say what you noticed. */
export function NodeTools({ link, verified, note, label }: { link: Link; verified: boolean; note: string | null; label: string }) {
  const { pending, error, run } = useAct();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? "");
  return (
    <div className={s.nodeTools}>
      {editing ? (
        <form className={s.noteForm} onSubmit={(e) => { e.preventDefault(); run(() => setLinkNote(link, text), () => setEditing(false)); }}>
          <input aria-label={`What you noticed: ${label}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="What you noticed" autoFocus />
          <button className={s.small} disabled={pending}>Save</button>
          <button type="button" className={s.small} onClick={() => { setText(note ?? ""); setEditing(false); }}>Cancel</button>
        </form>
      ) : (
        <span className={s.rowBtns}>
          {!verified && <button className={s.small} disabled={pending} onClick={() => run(() => verifyLink(link, true))} aria-label={`${label}: the link is right`}>✓ It&apos;s right</button>}
          <button className={s.small} disabled={pending} onClick={() => setEditing(true)} aria-label={`Note on ${label}`}>✎ Note</button>
          <button className={s.small} disabled={pending} onClick={() => run(() => removeLink(link))} aria-label={`Remove ${label} from the tree`}>✕</button>
        </span>
      )}
      <Err msg={error} />
    </div>
  );
}

/** Add a branch by hand: a title from the store, as an ancestor (inspired it) or a descendant (it influenced). */
export function AddBranch({ root, titles }: { root: string; titles: { id: string; t: string; y: number; lib: boolean; plex: boolean }[] }) {
  const { pending, error, run } = useAct();
  const [pick, setPick] = useState<string | null>(null);
  const [side, setSide] = useState<"ancestor" | "descendant">("ancestor");
  return (
    <div className={s.form}>
      <TitleChooser titles={titles.filter((t) => t.id !== root)} value={pick} onChange={setPick} label="Add a branch: a title from the store" busy={pending} />
      <Chips label="It" value={side} onChange={setSide} busy={pending} options={[{ value: "ancestor", label: "Inspired this one" }, { value: "descendant", label: "Was influenced by this one" }]} />
      <div className={s.btns}><button className="btn" disabled={pending || !pick} onClick={() => run(() => addLink(root, pick!, side), () => setPick(null))}>Add the branch</button></div>
      <Err msg={error} />
    </div>
  );
}

/** Ask Claude for (more) branches from the title's Wikipedia article. */
export function SuggestBranches({ title }: { title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/programmes/tree", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
      const out = (await r.json().catch(() => ({ error: `The server answered ${r.status}.` }))) as { added?: number; error?: string };
      if (out.error) setMsg(out.error); else { setMsg(out.added ? `${out.added} new branch${out.added === 1 ? "" : "es"} to check.` : "Nothing new in the article."); router.refresh(); }
    } catch { setMsg("Lost the connection to the app."); }
    setBusy(false);
  };
  return (
    <>
      <button className="btn" disabled={busy} onClick={go}>{busy ? "Reading Wikipedia…" : "Suggest branches from Wikipedia"}</button>
      {msg && <p className={s.muted} role="status">{msg}</p>}
    </>
  );
}

/** Asks Claude to write something for a v2 programme (a year's notes, one essay), as a plain request. */
function useWrite(body: Record<string, unknown>) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const write = async () => {
    setWriting(true); setError("");
    try {
      const r = await fetch("/api/programmes/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = (await r.json().catch(() => ({ error: `The server answered ${r.status}.` }))) as { error?: string };
      if (out.error) setError(out.error); else router.refresh();
    } catch { setError("Lost the connection to the app."); }
    setWriting(false);
  };
  return { writing, error, write };
}

/** Year in a decade: write the radio / news / fashion notes with Claude, and mark them checked. */
export function CapsuleTools({ slug, has, draft, canWrite }: { slug: string; has: boolean; draft: boolean; canWrite: boolean }) {
  const { pending, error, run } = useAct();
  const w = useWrite({ kind: "capsule", slug });
  return (
    <div className={s.essayTools}>
      {w.writing && <p className={s.muted} role="status">Reading that year&apos;s Wikipedia articles… under a minute.</p>}
      <div className={s.btns}>
        {canWrite && <button className="btn" disabled={w.writing} onClick={w.write}>{has ? "Rewrite the notes" : "Write the notes with Claude"}</button>}
        {has && <button className="btn" disabled={pending} onClick={() => run(() => setCapsuleChecked(slug, draft))}>{draft ? "Mark as checked" : "Back to draft"}</button>}
      </div>
      <Err msg={error || w.error} />
    </div>
  );
}

/** Essay series: one title's essay. Write it with Claude, edit it, mark it checked. */
export function ItemEssayTools({ slug, position, essay, draft, canWrite, label }: { slug: string; position: number; essay: string; draft: boolean; canWrite: boolean; label: string }) {
  const { pending, error, run } = useAct();
  const w = useWrite({ kind: "essay", slug, position });
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(essay);
  return (
    <div className={s.essayTools}>
      {w.writing && <p className={s.muted} role="status">Writing from Wikipedia… about a minute.</p>}
      {editing ? (
        <>
          <label className={s.field}><span>Essay: {label}</span><textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} /></label>
          <div className={s.btns}>
            <button className="btn primary" disabled={pending} onClick={() => run(() => saveItemEssay(slug, position, text, false), () => setEditing(false))}>Save draft</button>
            <button className="btn" disabled={pending} onClick={() => run(() => saveItemEssay(slug, position, text, true), () => setEditing(false))}>Save and mark checked</button>
            <button className="btn" onClick={() => { setText(essay); setEditing(false); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className={s.btns}>
          <button className="btn" onClick={() => { setText(essay); setEditing(true); }} aria-label={`${essay ? "Edit" : "Write"} the essay: ${label}`}>{essay ? "Edit" : "Write it yourself"}</button>
          {canWrite && <button className="btn" disabled={w.writing} onClick={w.write} aria-label={`${essay ? "Redraft" : "Draft"} with Claude: ${label}`}>{essay ? "Redraft with Claude" : "Draft with Claude"}</button>}
          {essay && draft && <button className="btn" disabled={pending} onClick={() => run(() => saveItemEssay(slug, position, essay, true))}>Mark as checked</button>}
        </div>
      )}
      <Err msg={error || w.error} />
    </div>
  );
}

/** The programme's tools that leave the store: download its poster, copy it to Plex as a collection. */
export function ProgrammeExtras({ slug, synced, plex }: { slug: string; synced: string | null; plex: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const toPlex = () => start(async () => {
    setMsg("");
    const r = await syncToPlex(slug).catch((e: Error) => ({ error: e.message, count: 0, skipped: 0 }));
    if (r.error) setMsg(r.error);
    else { setMsg(`In Plex as a collection: ${r.count} title${r.count === 1 ? "" : "s"}${r.skipped ? `, ${r.skipped} not on Plex skipped` : ""}.`); router.refresh(); }
  });
  return (
    <div className={s.btns}>
      <a className="btn" href={`/programmes/${slug}/poster`} download={`${slug}-poster.png`}>Download the poster</a>
      {plex && <button className="btn" disabled={pending} onClick={toPlex}>{pending ? "Copying to Plex…" : synced ? "Update the Plex collection" : "Make it a Plex collection"}</button>}
      {msg && <p className={s.muted} role="status">{msg}</p>}
    </div>
  );
}
