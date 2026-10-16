"use client";
import { useEffect, useState } from "react";
import { addonPath } from "../stremioActions";
import s from "./plex.module.css";

/*
 * The Stremio add-on on the Membership card: its address (built from the address this page was opened on,
 * so open the Membership card on the TV box to install it there) and an Install button.
 */
export function StremioPanel() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let on = true;
    addonPath().then((p) => { if (on) setUrl(`${location.origin}${p}`); }).catch(() => {});
    return () => { on = false; };
  }, []);
  const local = !!url && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url);
  const copy = async () => { try { await navigator.clipboard.writeText(url!); setCopied(true); } catch {} };
  return (
    <section className={s.panel} aria-labelledby="stremio-h">
      <h2 id="stremio-h" className={s.h2}>Stremio add-on</h2>
      <p className={s.note}>
        Your running festivals and 31 Days, and the collection, as catalogues in Stremio, in programme order. Titles you open
        from a box with Open in Stremio get a &ldquo;Did you finish it?&rdquo; the next time you come back here.
      </p>
      {!url ? <p className={s.note}>Checking…</p> : (
        <>
          <p className={s.sync} style={{ wordBreak: "break-all" }}>{url}</p>
          {local && <p className={s.bad}>This address only works on this computer. Open the Membership card on the TV box (or use your PC&apos;s network address) to install it there.</p>}
          <p className={s.note}>The address has a private key in it: keep it to yourself. If Stremio won&apos;t take an http:// address, see &ldquo;Stremio&rdquo; in the README.</p>
          <div className={s.btns}>
            <a className="btn primary" href={url.replace(/^https?:\/\//, "stremio://")}>Install in Stremio</a>
            <button className="btn" onClick={copy}>{copied ? "Copied" : "Copy the address"}</button>
          </div>
        </>
      )}
    </section>
  );
}
