"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { markBooklet, writeBooklet } from "./actions";
import s from "./booklet.module.css";

/* Write (on first open), rewrite, and mark checked. Writing takes about a minute. */
export function BookletActions({ slug, hasNotes, draft, canWrite, autoWrite }: { slug: string; hasNotes: boolean; draft: boolean; canWrite: boolean; autoWrite: boolean }) {
  const [writing, startWrite] = useTransition();
  const [marking, startMark] = useTransition();
  const pending = writing || marking;
  const [error, setError] = useState("");
  const started = useRef(false);

  const write = () => startWrite(async () => {
    setError("");
    const r = await writeBooklet(slug);
    if (r.error) setError(r.error);
  });
  const mark = (checked: boolean) => startMark(async () => {
    setError("");
    const r = await markBooklet(slug, checked);
    if (r.error) setError(r.error);
  });

  // Generated once, the first time the title is opened.
  useEffect(() => {
    if (!autoWrite || started.current) return;
    started.current = true;
    write();
  });

  return (
    <div className={s.actions}>
      {writing && <p className={s.status} role="status">Writing the booklet from Wikipedia… about a minute.</p>}
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.btns}>
        {hasNotes && draft && <button className={s.btn} onClick={() => mark(true)} disabled={pending}>Mark as checked</button>}
        {hasNotes && !draft && <button className={s.btn} onClick={() => mark(false)} disabled={pending}>Back to draft</button>}
        {canWrite && (hasNotes || error) && <button className={s.btn} onClick={write} disabled={pending}>{hasNotes ? "Rewrite" : "Try again"}</button>}
      </div>
    </div>
  );
}
