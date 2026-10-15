"use client";
import { useEffect, useRef } from "react";
import s from "./StoreShelf.module.css";

/* Names the tape under the remote's focus (or the pointer) beneath the shelf. */
export function ShelfLabel() {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const unit = ref.current?.parentElement;
    if (!unit) return;
    const show = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-title]");
      if (el && ref.current) ref.current.textContent = el.dataset.title!;
    };
    unit.addEventListener("focusin", show); unit.addEventListener("mouseover", show);
    return () => { unit.removeEventListener("focusin", show); unit.removeEventListener("mouseover", show); };
  }, []);
  return <p ref={ref} className={s.label} aria-hidden="true">Pick a tape with the arrows · OK to open it</p>;
}
