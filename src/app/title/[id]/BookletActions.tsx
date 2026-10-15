"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markBooklet } from "./actions";
import s from "./booklet.module.css";

/* Write (on first open), rewrite, and mark checked. Writing takes about a minute. */
export function BookletActions({ slug, hasNotes, draft, canWrite, autoWrite }: { slug: string; hasNotes: boolean; draft: boolean; canWrite: boolean; autoWrite: boolean }) {
  const [writing, setWriting] = useState(false);
  const router = useRouter();
  const [marking, startMark] = useTransition();
  const pending = writing || marking;
  const [error, setError] = useState("");
  const started = useRef(false);

  // A plain request, not a server action: the page and menu stay usable during the minute Claude writes.
  const write = async () => {
    setError(""); setWriting(true);
    try {
      const r = await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) });
      const out = (await r.json().catch(() => ({ error: `The server answered ${r.status}.` }))) as { error?: string };
      if (out.error) setError(out.error); else router.refresh();
    } catch { setError("Lost the connection to the app."); }
    setWriting(false);
  };
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
