"use client";
import { useState } from "react";
import type { Art, Title } from "@/lib/catalog";
import { VhsBox, type BoxCase, type BoxView, type BoxWear } from "./VhsBox";
import s from "./BoxViewer.module.css";

const VIEW_LABEL: Record<BoxView, string> = { angle: "On the shelf", front: "Front", spine: "Spine", back: "Back" };

/* The title page's box on a lit shelf. It only turns when a view is chosen. */
export function BoxViewer({ title, art, edition }: { title: Title; art: Art; edition?: string }) {
  const [view, setView] = useState<BoxView>("angle");
  const [kase, setKase] = useState<BoxCase>("sleeve");
  const [wear, setWear] = useState<BoxWear>("rented");
  const group = <T extends string>(label: string, opts: [T, string][], val: T, set: (v: T) => void) => (
    <div className={s.group} role="group" aria-label={label}>
      {opts.map(([v, l]) => <button key={v} className="btn" aria-pressed={val === v} onClick={() => set(v)} data-autofocus={label === "View" && v === "angle" ? true : undefined}>{l}</button>)}
    </div>
  );
  return (
    <div className={s.wrap}>
      <div className={s.stage}>
        <span className={s.shadow} aria-hidden="true" />
        <span className={s.shelf} aria-hidden="true" />
        <VhsBox title={title} art={art} width={300} view={view} kase={kase} wear={wear} back edition={edition} shopNo="0412" />
      </div>
      {group<BoxView>("View", (Object.keys(VIEW_LABEL) as BoxView[]).map((v) => [v, VIEW_LABEL[v]]), view, setView)}
      {group<BoxCase>("Case", [["sleeve", "Sleeve"], ["clam", "Clamshell"]], kase, setKase)}
      {group<BoxWear>("Wear", [["mint", "Mint"], ["rented", "Rented"], ["loved", "Well loved"]], wear, setWear)}
    </div>
  );
}
