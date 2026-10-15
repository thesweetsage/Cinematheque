"use client";
import { useCallback, useEffect, useState } from "react";
import { plexCheckLink, plexChooseServer, plexDisconnect, plexStartLink, plexStatus, plexSyncNow, type PlexStatus } from "./plexActions";
import s from "./plex.module.css";

const load = () => plexStatus().catch((e): PlexStatus => ({ state: "disconnected", error: e.message }));
const n = (x: number, one: string, many = one + "s") => `${x} ${x === 1 ? one : many}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/* Plex on the Membership card: connect with a plex.tv/link code, pick the server, see and start the sync. */
export function PlexPanel() {
  const [status, setStatus] = useState<PlexStatus | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  // Set when a sync was just asked for: keep checking until a report newer than this arrives.
  const [expect, setExpect] = useState<number | null>(null);

  const refresh = useCallback(async () => setStatus(await load()), []);
  useEffect(() => {
    let live = true;
    load().then((st) => { if (live) setStatus(st); });
    return () => { live = false; };
  }, []);

  // While a code is showing, check every 2 seconds whether it's been entered.
  useEffect(() => {
    if (!code) return;
    const id = setInterval(async () => {
      const r = await plexCheckLink();
      if ("waiting" in r) return;
      setCode(null);
      if ("error" in r) setMsg(r.error); else { setMsg(""); setStatus(r.status); setExpect(Date.now() - 5000); }
    }, 2000);
    return () => clearInterval(id);
  }, [code]);

  // While a sync runs (or one was just asked for), follow its progress.
  const connected = status?.state === "connected" ? status : null;
  const finished = connected?.last?.finishedAt ? Date.parse(connected.last.finishedAt) : 0;
  const waiting = !!connected && (connected.running || (expect !== null && finished < expect));
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(refresh, 2000);
    const giveUp = setTimeout(() => setExpect(null), 10 * 60_000);
    return () => { clearInterval(id); clearTimeout(giveUp); };
  }, [waiting, refresh]);

  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setMsg(""); try { await fn(); } catch (e) { setMsg((e as Error).message); } setBusy(false); };
  const connect = () => act(async () => { const r = await plexStartLink(); if ("error" in r) setMsg(r.error); else setCode(r.code); });
  const choose = (id: string) => act(async () => { const r = await plexChooseServer(id); if (r.error) setMsg(r.error); else setExpect(Date.now() - 5000); await refresh(); });
  const syncNow = () => act(async () => { setExpect(Date.now() - 5000); await plexSyncNow(); await refresh(); });
  const disconnect = () => act(async () => { await plexDisconnect(); await refresh(); });

  let body: React.ReactNode = <p className={s.note}>Checking…</p>;
  if (code) body = (
    <div className={s.link}>
      <p>On your phone or computer, go to <b>plex.tv/link</b>, sign in to Plex, and enter this code:</p>
      <p className={s.code} aria-label={`Code ${code.split("").join(" ")}`}>{code}</p>
      <p className={s.note}>Waiting for the code… This page carries on by itself once it&apos;s entered.</p>
      <button className="btn" onClick={() => setCode(null)}>Cancel</button>
    </div>
  );
  else if (status?.state === "no-db") body = <p className={s.note}>Connect the database first (see the README).</p>;
  else if (status?.state === "no-table") body = <p className={s.note}>One more step in Supabase: run <code>supabase/migrations/20261015120000_app_settings.sql</code> in the SQL Editor, then reload this page.</p>;
  else if (status?.state === "disconnected") body = (
    <>
      <p className={s.note}>Connect your Plex account to fill the shelves with your library and log what you watch, every hour.</p>
      {status.error && <p className={s.bad}>{status.error}</p>}
      <div className={s.btns}><button className="btn primary" onClick={connect} disabled={busy}>Connect Plex</button></div>
    </>
  );
  else if (status?.state === "choose") body = (
    <>
      <p className={s.note}>Which Plex server holds your library?</p>
      <div className={s.btns}>{status.servers.map((x) => <button key={x.machineId} className="btn" onClick={() => choose(x.machineId)} disabled={busy}>{x.name}</button>)}</div>
      {!status.servers.length && <p className={s.bad}>No Plex servers on this account.</p>}
    </>
  );
  else if (status?.state === "connected") {
    const l = status.last;
    body = (
      <>
        <p>Connected to <b>{status.server}</b>. The library syncs every hour while the app is running.</p>
        <div className={s.sync} role="status" aria-live="polite">
          {waiting ? <span className={s.live}>SYNCING · {status.progress || "Starting…"}</span>
            : l ? (
              <>
                <span>Last sync {when(l.finishedAt ?? l.startedAt)}{l.ok ? "" : " · FAILED"}</span>
                {l.ok ? (
                  <span className={s.counts}>{n(l.films, "film")} · {l.shows} series · {n(l.episodes, "episode")} · {l.added} new to the store · {n(l.newWatches, "new watch", "new watches")}{l.removed ? ` · ${l.removed} gone from Plex` : ""}{l.wishlistCleared ? ` · ${l.wishlistCleared} off the wishlist` : ""}</span>
                ) : <span className={s.bad}>{l.error}</span>}
                {l.unmatched.length > 0 && (
                  <div className={s.unmatched}>
                    <button className="btn" aria-expanded={showUnmatched} onClick={() => setShowUnmatched(!showUnmatched)}>{l.unmatched.length} not matched {showUnmatched ? "▲" : "▼"}</button>
                    {showUnmatched && <><p>Plex has no IMDb or TMDB id for these, or TMDB doesn&apos;t know them, so they&apos;re not in the store yet. Use &quot;Fix Match&quot; on them in Plex, then sync again.</p><ul>{l.unmatched.map((u) => <li key={u}>{u}</li>)}</ul></>}
                  </div>
                )}
              </>
            ) : <span>Not synced yet.</span>}
        </div>
        <div className={s.btns}>
          <button className="btn primary" onClick={syncNow} disabled={busy || waiting}>Sync now</button>
          {!status.fromEnv && <button className="btn" onClick={disconnect} disabled={busy || waiting}>Disconnect</button>}
        </div>
      </>
    );
  }

  return (
    <section className={s.panel} aria-labelledby="plex-h">
      <h2 id="plex-h" className={s.h2}>Plex</h2>
      {body}
      {msg && <p className={s.bad} role="alert">{msg}</p>}
    </section>
  );
}
