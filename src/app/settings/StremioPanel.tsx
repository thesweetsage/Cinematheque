"use client";
import { useEffect, useRef, useState } from "react";
import { addonInfo, type AddonInfo } from "../stremioActions";
import s from "./plex.module.css";

/*
 * The Stremio add-on on the Membership card.
 * Stremio only loads add-ons over https (plain http only from the same computer), so the real address is the
 * Supabase Edge Function's: always on, whether the app runs on the PC or the NAS. Until it's deployed, the card says
 * how, and offers the app's own address for Stremio on this computer only.
 * Stremio keeps add-ons in the Stremio account, so installing once anywhere puts it on the TV box too.
 */
export function StremioPanel() {
  const [info, setInfo] = useState<AddonInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let on = true;
    addonInfo().then((x) => { if (on) setInfo(x); }).catch(() => {});
    return () => { on = false; };
  }, []);
  const url = info ? info.cloud ?? `${location.origin.replace("//localhost", "//127.0.0.1")}${info.path}` : null;
  // The clipboard API needs https or localhost; on a home-network http address fall back to the old way.
  const copy = async () => {
    try { await navigator.clipboard.writeText(url!); setCopied(true); return; } catch {}
    field.current?.select();
    try { setCopied(document.execCommand("copy")); } catch {}
  };
  return (
    <section className={s.panel} aria-labelledby="stremio-h">
      <h2 id="stremio-h" className={s.h2}>Stremio add-on</h2>
      <p className={s.note}>
        Your running festivals and 31 Days, and the collection, as catalogues in Stremio, in programme order. Titles you open
        from a box with Open in Stremio get a &ldquo;Did you finish it?&rdquo; the next time you come back here.
      </p>
      {!info || !url ? <p className={s.note}>Checking…</p> : (
        <>
          <input ref={field} className={s.sync} readOnly value={url} aria-label="Add-on address" onFocus={(e) => e.currentTarget.select()}
            style={{ width: "100%", background: "transparent", border: "1px solid var(--edge)", color: "inherit", padding: "6px 8px" }} />
          {info.cloud ? (
            <p className={s.note}>
              Served by your Supabase project over https, so it works on every device and doesn&apos;t depend on this computer or the NAS.
              Press <b>Install in Stremio</b> on any device signed in to your Stremio account (or paste the address into the search box on
              Stremio&apos;s Add-ons page). Stremio keeps it in your account, so it appears on the TV box too.
            </p>
          ) : (
            <>
              <p className={s.bad}>
                Stremio only takes add-ons from other devices over https, so for the TV box the add-on is served by your Supabase project.
                That needs setting up once ({info.cloudError ?? "not deployed yet"}): see &ldquo;Stremio&rdquo; in the README, then reopen this card.
              </p>
              <p className={s.note}>Meanwhile the address above works in Stremio on this computer only.</p>
            </>
          )}
          <p className={s.note}>The address has a private key in it: keep it to yourself.</p>
          <div className={s.btns}>
            {info.cloud && <a className="btn primary" href={info.cloud.replace(/^https:\/\//, "stremio://")}>Install in Stremio</a>}
            <button className={info.cloud ? "btn" : "btn primary"} onClick={copy}>{copied ? "Copied" : "Copy the address"}</button>
          </div>
        </>
      )}
    </section>
  );
}
