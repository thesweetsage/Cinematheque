"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import s from "../programmes.module.css";

/*
 * The "Start a programme" forms for the v2 kinds. Each one posts to /api/programmes/build as a plain request (not a
 * server action), so the menu and the rest of the app stay usable while it builds, then opens the new programme.
 */

export function useBuild() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const build = async (body: Record<string, unknown>) => {
    setError(""); setBusy(true);
    try {
      const r = await fetch("/api/programmes/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = (await r.json().catch(() => ({ error: `The server answered ${r.status}.` }))) as { slug?: string; error?: string };
      if (out.slug) { router.push(`/programmes/${out.slug}`); return; }
      setError(out.error ?? "Something went wrong.");
    } catch {
      setError("Lost the connection to the app. Is it still running?");
    }
    setBusy(false);
  };
  return { busy, error, build };
}

export const Err = ({ msg }: { msg: string }) => (msg ? <p className={s.err} role="alert">{msg}</p> : null);

export type PickTitle = { id: string; t: string; y: number; lib: boolean; plex: boolean };

/** Choose one title: type to filter, shelf titles first. With `value` set, shows it with a Change button. */
export function TitleChooser({ titles, value, onChange, label, busy, autofocus }: { titles: PickTitle[]; value: string | null; onChange: (id: string | null) => void; label: string; busy?: boolean; autofocus?: boolean }) {
  const [q, setQ] = useState("");
  const chosen = value ? titles.find((t) => t.id === value) : null;
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n ? titles.filter((t) => t.t.toLowerCase().includes(n) || String(t.y) === n) : titles.filter((t) => t.lib);
    return [...list].sort((a, b) => Number(b.plex) - Number(a.plex) || Number(b.lib) - Number(a.lib) || a.t.localeCompare(b.t)).slice(0, 24);
  }, [q, titles]);
  if (chosen) {
    return (
      <div>
        <div className={s.fieldLabel}>{label}</div>
        <div className={s.chosen}>
          <b>{chosen.t}</b> <small>{chosen.y || ""}{chosen.plex ? " · on Plex" : ""}</small>
          <button type="button" className="btn" onClick={() => onChange(null)} disabled={busy} data-autofocus={autofocus ? true : undefined}>Change</button>
        </div>
      </div>
    );
  }
  return (
    <div className={s.picker}>
      <label className={s.field}><span>{label}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type part of a title or a year" autoComplete="off" disabled={busy} data-autofocus={autofocus ? true : undefined} /></label>
      {q.trim() && !hits.length && <p className={s.muted}>Nothing in the store matches. Find it in the Returns Slot first.</p>}
      <div className={s.hits}>
        {hits.map((t) => <button type="button" key={t.id} className={s.hit} disabled={busy} onClick={() => onChange(t.id)}>{t.t} <small>{t.y || ""}{t.plex ? " · on Plex" : t.lib ? "" : " · not on the shelves"}</small></button>)}
      </div>
    </div>
  );
}

/** A row of choice chips (one value). */
export function Chips<T extends string | number>({ label, options, value, onChange, busy }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; busy?: boolean }) {
  return (
    <div>
      <div className={s.fieldLabel}>{label}</div>
      <div className={s.chips} role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} aria-pressed={value === o.value} className={s.chip} disabled={busy} onClick={() => onChange(o.value)}>{o.label}</button>)}
      </div>
    </div>
  );
}

/** An on/off switch with a label. */
export function Toggle({ label, hint, on, onChange, busy }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <div className={s.toggleRow}>
      <div><b>{label}</b>{hint && <span>{hint}</span>}</div>
      <button type="button" className="btn" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)}>{on ? "On" : "Off"}</button>
    </div>
  );
}

/** Series marathon: which series, how many episodes a day or a week, from when. */
export function MarathonForm({ series, preset, today }: { series: PickTitle[]; preset: string | null; today: string }) {
  const { busy, error, build } = useBuild();
  const [pick, setPick] = useState<string | null>(preset && series.some((t) => t.id === preset) ? preset : null);
  const [per, setPer] = useState(2);
  const [unit, setUnit] = useState<"day" | "week">("day");
  const [start, setStart] = useState(today);
  const [skip, setSkip] = useState(true);
  return (
    <div className={s.form}>
      <TitleChooser titles={series} value={pick} onChange={setPick} label="The series" busy={busy} autofocus={!preset} />
      <Chips label="Episodes at a time" value={per} onChange={setPer} busy={busy} options={[1, 2, 3, 4, 6, 8].map((n) => ({ value: n, label: String(n) }))} />
      <Chips label="Every" value={unit} onChange={setUnit} busy={busy} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} />
      <label className={s.field}><span>Starting</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={busy} /></label>
      <Toggle label="Skip episodes I've seen" hint="Watched on Plex or ticked here before" on={skip} onChange={setSkip} busy={busy} />
      <div className={s.btns}><button type="button" className="btn primary" disabled={busy || !pick} onClick={() => build({ type: "marathon", series: pick, per, unit, start, skipWatched: skip })} data-autofocus={preset && pick ? true : undefined}>{pick ? `Print the marathon card: ${per} a ${unit}` : "Choose a series first"}</button></div>
      {busy && <p className={s.status} role="status">Fetching the episodes and dealing them into portions…</p>}
      <Err msg={error} />
    </div>
  );
}

/** Curriculum: a name, where the list comes from, and the list itself, pasted. */
export function CurriculumForm({ curator }: { curator: boolean }) {
  const { busy, error, build } = useBuild();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  return (
    <div className={s.form}>
      <label className={s.field}><span>Name</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="In Search of Darkness" disabled={busy} data-autofocus /></label>
      <label className={s.field}><span>Where the list comes from</span><input value={source} onChange={(e) => setSource(e.target.value)} maxLength={200} placeholder="The documentaries' own film list, Parts I to III" disabled={busy} /></label>
      <label className={s.field}><span>The list ({lines} line{lines === 1 ? "" : "s"})</span>
        <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} maxLength={40000} disabled={busy} placeholder={"Part I\nHalloween (1978)\nThe Fog (1980)\nPart II\nThe Thing (1982)"} />
      </label>
      <p className={s.muted}>{curator ? "Claude sorts it into chapters using only what's in your list (headings like Part I become chapters; no headings, it goes by year)." : "Headings like \"Part I\" become chapters; without headings it goes by year. One title per line, with its year if you have it."} Then every title is matched on TMDB, and you check the matches before it goes on the shelf.</p>
      <div className={s.btns}><button type="button" className="btn primary" disabled={busy || !lines} onClick={() => build({ type: "curriculum", title, source, text })}>{lines ? `Build the course from ${lines} line${lines === 1 ? "" : "s"}` : "Paste the list first"}</button></div>
      {busy && <p className={s.status} role="status">Reading the list and matching every title on TMDB… a long list takes a couple of minutes. You can leave this page; it carries on.</p>}
      <Err msg={error} />
    </div>
  );
}

type Person = { id: number; name: string; department: string; knownFor: string[]; photo: string | null };

/** Director retrospective: find the director on TMDB, choose them, and their filmography becomes the shelf. */
export function RetrospectiveForm({ preset }: { preset: string | null }) {
  const { busy, error, build } = useBuild();
  const [q, setQ] = useState(preset ?? "");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookError, setLookError] = useState("");
  const results = useRef<HTMLDivElement>(null);
  // With the remote, the found names are where you want to be next.
  useEffect(() => { if (people?.length) results.current?.querySelector<HTMLElement>("button")?.focus(); }, [people]);
  const find = async (name = q) => {
    if (!name.trim()) return;
    setLooking(true); setLookError("");
    try {
      const r = await fetch(`/api/people?q=${encodeURIComponent(name.trim())}`);
      const out = (await r.json()) as { people?: Person[]; error?: string };
      if (out.error) setLookError(out.error); else setPeople(out.people ?? []);
    } catch { setLookError("Lost the connection to the app."); }
    setLooking(false);
  };
  return (
    <div className={s.form}>
      <form className={s.themeRow} onSubmit={(e) => { e.preventDefault(); void find(); }}>
        <label className={s.field}><span>Director</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="John Carpenter, Agnès Varda, Hayao Miyazaki…" disabled={busy} data-autofocus={!preset ? true : undefined} /></label>
        <button className="btn" disabled={busy || looking || !q.trim()} data-autofocus={preset ? true : undefined}>{looking ? "Looking…" : "Find"}</button>
      </form>
      {people && !people.length && <p className={s.muted}>Nobody by that name on TMDB.</p>}
      {people && people.length > 0 && (
        <div className={s.kinds} ref={results}>
          {people.map((p, i) => (
            <button key={p.id} type="button" className={s.option} disabled={busy} onClick={() => build({ type: "retrospective", personId: p.id })} data-autofocus={i === 0 ? true : undefined}>
              <b>{p.name}</b>
              <span>{p.department}{p.knownFor.length ? ` · ${p.knownFor.join(", ")}` : ""}</span>
            </button>
          ))}
        </div>
      )}
      {busy && <p className={s.status} role="status">Fetching the filmography from TMDB{" "}and writing the staff card… up to a minute.</p>}
      <Err msg={error || lookError} />
    </div>
  );
}

/** Family tree: choose the title in the middle. */
export function FamilyTreeForm({ titles, preset, curator }: { titles: PickTitle[]; preset: string | null; curator: boolean }) {
  const { busy, error, build } = useBuild();
  const [pick, setPick] = useState<string | null>(preset && titles.some((t) => t.id === preset) ? preset : null);
  return (
    <div className={s.form}>
      <TitleChooser titles={titles} value={pick} onChange={setPick} label="The title in the middle" busy={busy} autofocus={!pick} />
      <div className={s.btns}><button type="button" className="btn primary" disabled={busy || !pick} onClick={() => build({ type: "family_tree", title: pick })} data-autofocus={pick ? true : undefined}>{pick ? "Draw the tree" : "Choose a title first"}</button></div>
      {busy && <p className={s.status} role="status">{curator ? "Reading its Wikipedia article for what inspired it and what it influenced, and finding each on TMDB… under a minute." : "Drawing the tree…"}</p>}
      <Err msg={error} />
    </div>
  );
}
