"use client";
import { useEffect, useRef } from "react";
import s from "./WalkIn.module.css";

/*
 * The walk into the store: full-screen footage that ends facing the new releases wall, then fades to the live shelf.
 * Plays once a day (later visits go straight to the shelf), never with effects off or reduced motion.
 * OK or Back skips it; "Walk in again" on the store front replays it.
 * The festival wall uses it too, for the pan from the shelves to the board (its own key, so its own once a day).
 */
export function WalkIn({ src, poster, storageKey = "cine_walkin", label = "Walking into the store", replay = "cine:walkin" }: { src: string; poster: string | null; storageKey?: string; label?: string; replay?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = root.current, v = video.current;
    if (!el || !v) return;
    const finish = () => {
      if (el.hidden) return;
      el.removeAttribute("data-overlay");
      el.classList.add(s.out);
      v.pause();
      setTimeout(() => { el.hidden = true; el.classList.remove(s.out); (document.querySelector("[data-autofocus]") as HTMLElement | null)?.focus(); }, 600);
    };
    const play = () => {
      el.hidden = false;
      el.setAttribute("data-overlay", ""); // the remote's Back closes it (RemoteNav sends cine:close)
      v.currentTime = 0;
      v.play().catch(finish);
      el.querySelector("button")?.focus();
      try { localStorage.setItem(storageKey, new Date().toDateString()); } catch {}
    };
    let seen = false;
    try { seen = localStorage.getItem(storageKey) === new Date().toDateString(); } catch {}
    const calm = !document.documentElement.classList.contains("fx");
    if (!seen && !calm) play();
    const again = () => play();
    v.addEventListener("ended", finish);
    el.addEventListener("cine:close", finish);
    window.addEventListener(replay, again);
    return () => { v.removeEventListener("ended", finish); el.removeEventListener("cine:close", finish); window.removeEventListener(replay, again); };
  }, [storageKey, replay]);

  return (
    <div ref={root} className={s.walk} hidden role="dialog" aria-label={label}>
      <video ref={video} className={s.video} src={src} poster={poster ?? undefined} muted playsInline preload="auto" />
      <button className={`btn ${s.skip}`} onClick={() => root.current?.dispatchEvent(new CustomEvent("cine:close"))}>Skip ▶</button>
    </div>
  );
}

export function WalkInAgain() {
  return <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent("cine:walkin"))}>Walk in again</button>;
}
