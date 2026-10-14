"use client";
import { useEffect, useState } from "react";
import s from "./Aisle.module.css";

/* Lights-on sequence (CSS only): full version on the first visit of the day, a short one after. Also shows the focused tape's name. */
export function AisleLights() {
  const [label, setLabel] = useState("◀ ▶ ▲ ▼ TO BROWSE · OK TO OPEN A TAPE");
  useEffect(() => {
    const scene = document.getElementById("aisle");
    if (!scene) return;
    let mode = "short";
    try { const today = new Date().toDateString(); if (localStorage.getItem("cine_lights") !== today) { mode = "full"; localStorage.setItem("cine_lights", today); } } catch {}
    if (document.documentElement.classList.contains("fx")) scene.dataset.intro = mode;
    const show = (e: Event) => { const el = (e.target as HTMLElement).closest<HTMLElement>("[data-title]"); if (el) setLabel("▶ " + el.dataset.title!.toUpperCase()); };
    scene.addEventListener("focusin", show); scene.addEventListener("mouseover", show);
    return () => { scene.removeEventListener("focusin", show); scene.removeEventListener("mouseover", show); };
  }, []);
  return <div className={s.hint} aria-live="polite">{label}</div>;
}
