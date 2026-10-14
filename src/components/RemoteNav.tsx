"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
 * Remote control navigation for the TV box (and arrow keys on a keyboard).
 * Arrows move focus to the nearest focusable thing in that direction. OK is Enter (native click).
 * Back (Backspace / GoBack / Escape) closes the top overlay, otherwise goes to the previous page.
 * Overlays mark themselves with [data-overlay] and listen for the "cine:close" event.
 */
const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]';

function visible(el: Element) {
  if (el.closest('[aria-hidden="true"],[hidden],[inert]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== "hidden";
}
function scope(): ParentNode {
  const overlays = document.querySelectorAll("[data-overlay]");
  return overlays.length ? overlays[overlays.length - 1] : document;
}
function candidates() { return [...scope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible); }

function focusFirst() {
  const root = scope();
  const el = root.querySelector<HTMLElement>("[data-autofocus]") ?? candidates().find((e) => e.closest("main")) ?? candidates()[0];
  el?.focus({ preventScroll: true });
  if (el) reveal(el);
}
function reveal(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (r.top < 80 || r.bottom > innerHeight - 100) el.scrollIntoView({ block: "center", inline: "nearest", behavior: smooth ? "smooth" : "auto" });
  else el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

type Dir = "up" | "down" | "left" | "right";
function move(dir: Dir) {
  const list = candidates();
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || cur === document.body || !list.includes(cur)) return focusFirst();
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    // Compare centres, not edges: a focused item is scaled up and may overlap its neighbours.
    const ahead = dir === "right" ? dx > 4 && r.left > a.left : dir === "left" ? dx < -4 && r.right < a.right : dir === "down" ? dy > 4 && r.top > a.top : dy < -4 && r.bottom < a.bottom;
    if (!ahead) continue;
    const horizontal = dir === "left" || dir === "right";
    const score = (horizontal ? Math.abs(dx) : Math.abs(dy)) + (horizontal ? Math.abs(dy) : Math.abs(dx)) * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus({ preventScroll: true }); reveal(best); }
}

export function RemoteNav() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    const keys: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range") || t.tagName === "TEXTAREA";
      const dir = keys[e.key];
      if (dir) {
        if ((t as HTMLInputElement).type === "range" && (dir === "left" || dir === "right")) return;
        if (typing && (dir === "left" || dir === "right")) return;
        e.preventDefault();
        document.documentElement.classList.add("remote");
        move(dir);
        return;
      }
      const back = e.key === "GoBack" || e.key === "BrowserBack" || e.key === "Escape" || (e.key === "Backspace" && !typing);
      if (back) {
        e.preventDefault();
        const overlays = document.querySelectorAll("[data-overlay]");
        if (overlays.length) overlays[overlays.length - 1].dispatchEvent(new CustomEvent("cine:close"));
        else if (history.length > 1) router.back();
      }
    };
    const onPointer = () => document.documentElement.classList.remove("remote");
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onPointer);
    return () => { removeEventListener("keydown", onKey); removeEventListener("pointerdown", onPointer); };
  }, [router]);

  // After every page change, put focus somewhere sensible when driven by a remote.
  useEffect(() => {
    const d = document.documentElement;
    if (!d.classList.contains("remote") && !d.classList.contains("tv")) return;
    const id = setTimeout(focusFirst, 60);
    return () => clearTimeout(id);
  }, [path]);

  return null;
}
