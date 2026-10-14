"use client";
/* eslint-disable @next/next/no-img-element -- TMDB thumbnails */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Art, Title } from "@/lib/catalog";
import type { SearchHit } from "@/lib/tmdb";
import { VhsBox } from "./VhsBox";
import s from "./ReturnsSlot.module.css";

type Preview = { title: Title; art: Art; hit: SearchHit };

/* The Returns Slot: search TMDB, see the title as a VHS box (real poster, generated spine), add it to the library. */
export function ReturnsSlot() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saved, setSaved] = useState<{ msg: string; slug?: string } | null>(null);
  const timer = useRef<number>(0);
  const addBtn = useRef<HTMLButtonElement>(null);

  // When a tape is pulled, put the remote on its main action.
  useEffect(() => { if (preview) addBtn.current?.focus(); }, [preview]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) return;
    timer.current = window.setTimeout(async () => {
      setStatus("TRACKING…");
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ error: "No connection" }));
      if (res.error) { setStatus(`Search failed: ${res.error}`); return; }
      setHits(res.results); setStatus(res.results.length ? `${res.results.length} TAPES FOUND` : "NO TAPES MATCH. TRY THE YEAR OR A DIRECTOR.");
    }, 350);
  }, [q]);

  const open = async (hit: SearchHit) => {
    setSaved(null); setStatus("PULLING THE TAPE…");
    const res = await fetch(`/api/preview?kind=${hit.kind}&id=${hit.tmdbId}`).then((r) => r.json());
    if (res.error) { setStatus(`Couldn't load that title: ${res.error}`); return; }
    setPreview({ ...res, hit }); setStatus("");
  };
  const add = async () => {
    if (!preview) return;
    const res = await fetch("/api/titles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: preview.hit.kind, tmdbId: preview.hit.tmdbId }) }).then((r) => r.json());
    setSaved(res.error ? { msg: res.error } : { msg: "On the shelf.", slug: res.slug });
  };

  return (
    <div>
      <div className="osd-label">Search</div>
      <h1 className={s.h1}>The Returns Slot</h1>
      <div className={s.slot}>
        <label htmlFor="q" className="sr-only">Search films and series</label>
        <input id="q" className={s.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="TYPE A TITLE…" autoComplete="off" data-autofocus />
      </div>
      <p className={s.status} aria-live="polite">{q.trim() ? status : ""}</p>
      {preview && (
        <section className={s.preview} aria-label={`${preview.title.t} preview`}>
          <div className={s.stage}><VhsBox title={preview.title} art={preview.art} width={220} back /></div>
          <div className={s.pinfo}>
            <div className="osd-label">{preview.title.kind === "series" ? "Series" : "Film"} · {preview.title.y}{preview.title.run ? ` · ${preview.title.run}` : ""}</div>
            <h2 className={s.ptitle}>{preview.title.t}</h2>
            <p className={s.pmeta}>{preview.title.dir}{preview.title.imdb ? ` · IMDb ${preview.title.imdb}` : ""}{preview.title.rt ? ` · RT ${preview.title.rt}%` : ""}</p>
            <p className={s.psyn}>{preview.title.syn}</p>
            <div className={s.pbtns}><button ref={addBtn} className="btn primary" onClick={add}>Add to my library</button><button className="btn" onClick={() => setPreview(null)}>Close</button></div>
            {saved && <p className={s.saved} role="status">{saved.msg}{saved.slug && <> <Link href={`/title/${saved.slug}`}>Open the box</Link></>}</p>}
          </div>
        </section>
      )}
      <ul className={s.results}>
        {q.trim() && hits.map((h) => (
          <li key={`${h.kind}${h.tmdbId}`}>
            <button className={s.hit} onClick={() => open(h)} aria-label={`${h.title}${h.year ? `, ${h.year}` : ""}, ${h.kind === "tv" ? "series" : "film"}`}>
              {h.poster ? <img src={h.poster} alt="" loading="lazy" /> : <span className={s.noart}>{h.title}</span>}
              <span>{h.title}<small>{h.year ?? "?"} · {h.kind === "tv" ? "SERIES" : "FILM"}</small></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
