"use client";
import { useState } from "react";
import type { Review } from "@/lib/tmdb";
import s from "./extras.module.css";

const SHORT = 420;

export function ReviewCard({ review: r }: { review: Review }) {
  const [open, setOpen] = useState(false);
  const long = r.text.length > SHORT;
  const text = open || !long ? r.text : r.text.slice(0, SHORT).replace(/\s+\S*$/, "") + "…";
  return (
    <article className={s.review}>
      <header className={s.rhead}>
        <b>{r.author}</b>
        {r.rating != null && <span>{r.rating}/10</span>}
        <span>{r.date}</span>
      </header>
      {text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
      <div className={s.rbtns}>
        {long && <button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Show less" : "Read it all"}</button>}
        <a className="btn" href={r.url} target="_blank" rel="noreferrer">On TMDB</a>
      </div>
    </article>
  );
}
