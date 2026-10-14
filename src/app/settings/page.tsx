"use client";
import { useSyncExternalStore } from "react";

/* The <html> classes are the source of truth for these switches (set before paint in layout.tsx). */
function watchClasses(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => o.disconnect();
}

/* Membership card: the switches that live on this device (TV mode, effects). Connections arrive in phase 2 and 3. */
export default function Settings() {
  const tv = useSyncExternalStore(watchClasses, () => document.documentElement.classList.contains("tv"), () => false);
  const fx = useSyncExternalStore(watchClasses, () => document.documentElement.classList.contains("fx"), () => true);
  const flip = (cls: "tv" | "fx", key: string, on: boolean) => {
    document.documentElement.classList.toggle(cls, on);
    try { localStorage.setItem(key, on ? "1" : "0"); } catch {}
  };
  const row = (label: string, hint: string, on: boolean, act: () => void, first = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 0", borderTop: "1px solid var(--edge)" }}>
      <div><div style={{ fontWeight: 600 }}>{label}</div><div style={{ color: "var(--muted)", fontSize: 14 }}>{hint}</div></div>
      <button className="btn" role="switch" aria-checked={on} onClick={act} data-autofocus={first ? true : undefined}>{on ? "On" : "Off"}</button>
    </div>
  );
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="osd-label">Settings</div>
      <h1 style={{ fontFamily: "var(--font-bungee)", fontWeight: 400, fontSize: "clamp(34px,5vw,56px)", lineHeight: 1, margin: "6px 0 20px" }}>Membership card</h1>
      {row("TV mode", "Bigger text and safe margins for the projector, lighter effects. On automatically on the TV box.", tv, () => flip("tv", "cine_tv", !tv), true)}
      {row("Effects", "Scanlines and the lights-on sequence. Always off when your device asks for reduced motion.", fx, () => flip("fx", "cine_fx", !fx))}
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 18 }}>Plex, TMDB and Stremio connections are added in the next phases.</p>
    </div>
  );
}
