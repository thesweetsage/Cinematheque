"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { recsStatus, refreshCards, runRecsNow, type RecsStatus } from "../recActions";
import s from "./plex.module.css";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/* Staff cards on the Membership card: what the taste profile says, the last nightly run, and "write new cards now". */
export function RecsPanel() {
  const [st, setSt] = useState<RecsStatus | null>(null);
  const [asked, setAsked] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const askedRef = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const x = await recsStatus().catch(() => null);
    setSt(x);
    // The run this card started has finished: refresh the Store Front so the new cards show straight away.
    const done = x?.report?.finishedAt ? Date.parse(x.report.finishedAt) : 0;
    if (x && askedRef.current !== null && !x.running && done >= askedRef.current) {
      askedRef.current = null;
      setAsked(null);
      await refreshCards().catch(() => {});
    }
  }, []);
  useEffect(() => { let on = true; recsStatus().then((x) => { if (on) setSt(x); }).catch(() => {}); return () => { on = false; }; }, []);

  const finished = st?.report?.finishedAt ? Date.parse(st.report.finishedAt) : 0;
  const waiting = !!st && (st.running || (asked !== null && finished < asked));

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(refresh, 3000);
    const giveUp = setTimeout(() => setAsked(null), 10 * 60_000);
    return () => { clearInterval(id); clearTimeout(giveUp); };
  }, [waiting, refresh]);

  const run = async () => {
    setMsg("");
    const r = await runRecsNow();
    if (r.error) setMsg(r.error); else { const t = Date.now() - 5000; askedRef.current = t; setAsked(t); await refresh(); }
  };

  const r = st?.report;
  return (
    <section className={s.panel} aria-labelledby="recs-h">
      <h2 id="recs-h" className={s.h2}>Staff cards</h2>
      {!st ? <p className={s.note}>Checking…</p> : !st.connected ? <p className={s.note}>Connect the database to get recommendations.</p> : (
        <>
          <p className={s.note}>
            Written every night from your Plex watches and ratings: Popular Picks, Deep Cuts, and once a week ten deep cuts from Claude,
            each checked against TMDB. Thumbs on a card count towards the next night&apos;s list.
          </p>
          {st.genres.length > 0 && (
            <dl className={s.facts}>
              <div><dt>Your genres</dt><dd>{st.genres.join(", ")}</dd></div>
              {st.keywords.length > 0 && <div><dt>Keeps coming up</dt><dd>{st.keywords.join(", ")}</dd></div>}
              {st.seeds.length > 0 && <div><dt>Recent favourites</dt><dd>{st.seeds.join(", ")}</dd></div>}
            </dl>
          )}
          {waiting ? <p className={s.note} role="status">Writing new cards… this takes a minute or two.</p>
            : r ? <p className={s.note} role="status">
                {r.ok ? `Last written ${when(r.finishedAt ?? r.startedAt)}: ${r.popular} popular picks, ${r.deep} deep cuts${r.claude ? `, ${r.claude} from Claude` : ""}${r.claudeDropped ? ` (${r.claudeDropped} not found on TMDB, dropped)` : ""}.`
                  : `The last run failed: ${r.error}`}
              </p>
            : <p className={s.note}>No cards written yet.</p>}
          {msg && <p className={s.note} role="alert">{msg}</p>}
          <div className={s.btns}><button className="btn" onClick={run} disabled={waiting}>Write new cards now</button></div>
        </>
      )}
    </section>
  );
}
