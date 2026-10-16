"use client";
/* eslint-disable @next/next/no-img-element -- one small poster */
import { useCallback, useEffect, useRef, useState } from "react";
import s from "./FinishCheck.module.css";

type Check = { id: string; slug: string; title: string; year: number | null; kind: string; poster: string | null };

/*
 * "Did you finish it?" After Open in Stremio, the next time the app is opened (or comes back on screen)
 * it asks: Yes (then the stars), Not yet (ask again next time) or Dropped it. Back means Not yet.
 */
export function FinishCheck() {
  const [check, setCheck] = useState<Check | null>(null);
  const [step, setStep] = useState<"ask" | "rate">("ask");
  const [err, setErr] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const shown = useRef<Check | null>(null);

  const look = useCallback(async () => {
    if (document.visibilityState !== "visible" || busy.current) return;
    try {
      const r = await fetch("/api/checks", { cache: "no-store" });
      if (!r.ok) return;
      const { check: c } = (await r.json()) as { check: Check | null };
      // A question already on screen stays as it is (a late answer from here must not reset it).
      if (c && !shown.current) { shown.current = c; setStep("ask"); setErr(null); setCheck(c); }
    } catch {}
  }, []);

  useEffect(() => {
    const first = setTimeout(look, 1500); // after the walk-in has had its turn
    document.addEventListener("visibilitychange", look);
    return () => { clearTimeout(first); document.removeEventListener("visibilitychange", look); };
  }, [look]);

  const answer = useCallback(async (a: "yes" | "later" | "dropped", rating?: number) => {
    if (!check || busy.current) return;
    busy.current = true;
    try {
      const r = await fetch("/api/checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "answer", id: check.id, answer: a, rating }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setErr(j.error ?? "That didn't save. Try again."); return; }
      shown.current = null;
      setCheck(null);
      const ret = document.querySelector<HTMLElement>("[data-autofocus]");
      ret?.focus({ preventScroll: true });
    } catch { setErr("That didn't save. Try again."); }
    finally { busy.current = false; }
    // There may be another one waiting.
    setTimeout(look, 300);
  }, [check, look]);

  // Back on the remote = Not yet.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const close = () => answer("later");
    el.addEventListener("cine:close", close);
    return () => el.removeEventListener("cine:close", close);
  }, [answer, check]);

  // Focus the first choice whenever the question (or its step) appears.
  useEffect(() => {
    if (check) root.current?.querySelector<HTMLElement>("button")?.focus();
  }, [check, step]);

  if (!check) return null;
  const what = check.kind === "series" ? "watching" : "finish";
  return (
    <div ref={root} className={s.veil} data-overlay role="dialog" aria-modal="true" aria-labelledby="finish-h">
      <div className={s.card}>
        {check.poster ? <img className={s.poster} src={check.poster} alt="" /> : <span className={s.poster} />}
        <div>
          <div className="osd-label">Back from Stremio</div>
          {step === "ask" ? (
            <>
              <h2 id="finish-h" className={s.h}>Did you {what} {check.title}?</h2>
              <p className={s.sub}>{check.year ? `${check.year}. ` : ""}You opened it in Stremio. A yes goes on your rental history and ticks it off any programme it&apos;s in.</p>
              <div className={s.row}>
                <button className="btn primary" onClick={() => setStep("rate")}>Yes, I {check.kind === "series" ? "watched it" : "finished it"}</button>
                <button className="btn" onClick={() => answer("later")}>Not yet</button>
                <button className="btn" onClick={() => answer("dropped")}>Dropped it</button>
              </div>
            </>
          ) : (
            <>
              <h2 id="finish-h" className={s.h}>How many stars?</h2>
              <p className={s.sub}>{check.title}</p>
              <div className={s.row} role="group" aria-label="Your stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`btn ${s.stars}`} onClick={() => answer("yes", n)} aria-label={`${n} ${n === 1 ? "star" : "stars"}`}>{"★".repeat(n)}</button>
                ))}
                <button className="btn" onClick={() => answer("yes")}>No stars</button>
              </div>
            </>
          )}
          {err && <p className={s.err} role="alert">{err}</p>}
        </div>
      </div>
    </div>
  );
}
