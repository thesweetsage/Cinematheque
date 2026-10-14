/* eslint-disable @next/next/no-img-element -- covers are small local files; plain <img> keeps the 3D faces cheap on the TV box */
import type { CSSProperties } from "react";
import type { Art, Title } from "@/lib/catalog";
import s from "./VhsBox.module.css";

export type BoxView = "angle" | "front" | "spine" | "back";
export type BoxCase = "sleeve" | "clam";
export type BoxWear = "mint" | "rented" | "loved";

const VIEWS: Record<BoxView, [number, number]> = { angle: [3, 26], front: [0, 0], spine: [0, 90], back: [0, 180] };

type Props = {
  title: Title; art: Art; width?: number; view?: BoxView; kase?: BoxCase; wear?: BoxWear;
  /** Render the back cover. Off for shelf boxes to keep the DOM small. */
  back?: boolean; shopNo?: string; edition?: string;
};

/**
 * A VHS box as a real 3D cuboid: poster on the front, generated spine on the LEFT, back cover with details.
 * It never moves by itself; the parent changes `view` when the person asks.
 */
export function VhsBox({ title: t, art, width = 290, view = "angle", kase = "sleeve", wear = "rented", back = false, shopNo, edition }: Props) {
  const [rx, ry] = VIEWS[view];
  const style = {
    "--w": `${width}px`, "--rx": `${rx}deg`, "--ry": `${ry}deg`,
    "--bg": art.bg, "--accent": art.accent, "--ar": art.logoRatio,
  } as CSSProperties;
  const fmt = t.kind === "series" ? "BOX SET" : "VHS";
  const spineClass = `${s.ins} ${s.spine} ${art.logoDark ? s.light : ""}`;
  return (
    <div className={`${s.box} ${kase === "clam" ? s.clam : ""} ${s[wear]}`} style={style} aria-hidden="true">
      <div className={`${s.face} ${s.front}`}>
        <div className={s.ins}>
          {art.poster ? <img className={s.art} src={art.poster} alt="" decoding="async" loading="lazy" />
            : <div className={s.fallback}><span>{t.t}</span><small>{t.y}</small></div>}
        </div>
        {edition && <span className={s.edition}>No. {edition}</span>}
        <span className={`${s.stk} ${s.rent}`}>CINEMATHEQUE<b>RENTAL</b>VIDEO</span>
        <span className={`${s.stk} ${s.price}`}>€1,50 · 2 NIGHTS</span>
        <span className={s.residue} /><span className={s.gloss} /><span className={s.wearLayer} />
      </div>
      <div className={`${s.face} ${s.spineFace}`}>
        <div className={spineClass}>
          <span className={s.band} />
          {art.logo ? <img className={s.logo} src={art.logo} alt="" decoding="async" loading="lazy" /> : <span className={s.spineTitle}>{t.t}</span>}
          <span className={s.fmt}>{fmt}</span><span className={s.year}>{t.y}</span>
        </div>
        {shopNo && <span className={s.spineLabel}>No. {shopNo}</span>}
        <span className={s.tape} /><span className={s.gloss} /><span className={s.wearLayer} />
      </div>
      <div className={`${s.face} ${s.spineFace2}`}><div className={spineClass}><span className={s.band} /><span className={s.fmt}>{fmt}</span></div></div>
      <div className={`${s.face} ${s.top}`}><div className={`${s.ins} ${s.lid}`} /><span className={s.wearLayer} /></div>
      <div className={`${s.face} ${s.bottom}`}><div className={`${s.ins} ${s.lid}`} /></div>
      {back && (
        <div className={`${s.face} ${s.back}`}>
          <div className={`${s.ins} ${s.backIns}`}>
            {art.logo ? <img className={`${s.backLogo} ${art.logoDark ? s.invert : ""}`} src={art.logo} alt="" /> : <b className={s.backTitle}>{t.t}</b>}
            <p>{t.syn}</p>
            {art.backdrop && (
              <div className={s.stills}>
                {["12% 40%", "55% 50%", "92% 45%"].map((p) => <i key={p} style={{ backgroundImage: `url(${art.backdrop})`, backgroundPosition: p }} />)}
              </div>
            )}
            <div className={s.bill}>{t.kind === "series" ? "Created by" : "Directed by"} {t.dir}{t.cast && <><br />Starring {t.cast}</>}</div>
            <div className={s.info}><span>{t.run || t.y}</span><span>COLOUR</span><span>HI-FI STEREO</span><span>PAL</span></div>
            <div className={s.foot}><span className={s.barcode} /><span className={s.house}><b>Cinematheque</b>VIDEO · {t.y}</span></div>
          </div>
          <span className={s.gloss} /><span className={s.wearLayer} />
        </div>
      )}
    </div>
  );
}
