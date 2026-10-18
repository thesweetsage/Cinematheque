"use client";
import { useEffect, useRef, useState } from "react";
import { addonPath } from "../stremioActions";
import s from "./plex.module.css";

/*
 * The Stremio add-on on the Membership card: its address. Stremio syncs add-ons through the Stremio account, so it's
 * installed once (in Stremio on the PC) with the PC's home-network address, and then shows up on the TV box as well.
 * Stremio turns a stremio:// link into https://, so the one-press Install only works when the app is on https.
 * On plain http (the PC, the home network) the address is pasted into Stremio's add-on search instead.
 * With no network address, "localhost" is shown as 127.0.0.1, the plain-http address Stremio always accepts.
 */
export function StremioPanel() {
  const [url, setUrl] = useState<string | null>(null);
  const [onPc, setOnPc] = useState(false);
  const [copied, setCopied] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let on = true;
    addonPath().then(({ path, lan }) => {
      if (!on) return;
      // Opened on the PC itself: give the network address (reachable from the box), or 127.0.0.1 if there's none.
      const here = /^http:\/\/(localhost|127\.0\.0\.1)/.test(location.origin);
      setOnPc(here);
      setUrl(`${here ? lan ?? location.origin.replace("//localhost", "//127.0.0.1") : location.origin}${path}`);
    }).catch(() => {});
    return () => { on = false; };
  }, []);
  const https = !!url?.startsWith("https://");
  const local = !!url && /^http:\/\/127\.0\.0\.1/.test(url);
  // The clipboard API needs https or localhost; on a home-network http address fall back to the old way.
  const copy = async () => {
    try { await navigator.clipboard.writeText(url!); setCopied(true); return; } catch {}
    const el = field.current;
    if (!el) return;
    el.select();
    try { setCopied(document.execCommand("copy")); } catch {}
  };
  return (
    <section className={s.panel} aria-labelledby="stremio-h">
      <h2 id="stremio-h" className={s.h2}>Stremio add-on</h2>
      <p className={s.note}>
        Your running festivals and 31 Days, and the collection, as catalogues in Stremio, in programme order. Titles you open
        from a box with Open in Stremio get a &ldquo;Did you finish it?&rdquo; the next time you come back here.
      </p>
      {!url ? <p className={s.note}>Checking…</p> : (
        <>
          <input ref={field} className={s.sync} readOnly value={url} aria-label="Add-on address" onFocus={(e) => e.currentTarget.select()}
            style={{ width: "100%", background: "transparent", border: "1px solid var(--edge)", color: "inherit", padding: "6px 8px" }} />
          {https ? (
            <p className={s.note}>Press Install in Stremio, or paste the address into the search box on Stremio&apos;s Add-ons page.</p>
          ) : (
            <p className={s.note}>
              Nothing to type on the TV box: in <b>Stremio on this computer</b>, signed in with the same Stremio account as the box,
              open <b>Add-ons</b>, paste this address into the search box at the top and press <b>Install</b>. Stremio adds it to
              your account, so it appears on the TV box too. After that you don&apos;t need Stremio on this computer at all: the box reads the catalogues straight from wherever the Cinematheque runs (this PC while testing, the NAS later; move it and you install the new address once).
              {local ? " This computer has no network address right now, so this one only works here." : !onPc ? " This is the address you opened this page on." : ""}
              {" If Stremio says it failed to fetch, it wants https: see “Stremio” in the README."}
            </p>
          )}
          <p className={s.note}>The address has a private key in it: keep it to yourself.</p>
          <div className={s.btns}>
            <button className="btn primary" onClick={copy}>{copied ? "Copied" : "Copy the address"}</button>
            {https && <a className="btn" href={url.replace(/^https:\/\//, "stremio://")}>Install in Stremio</a>}
          </div>
        </>
      )}
    </section>
  );
}
