"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rateRec, setWish, wishTmdb } from "@/app/recActions";
import s from "./RecActions.module.css";

/* The buttons under a staff card: thumbs up / down, and the wishlist. Remote-friendly: plain buttons, one row. */

type Feedback = "up" | "down" | "dismissed" | null;

export function RecThumbs({ recId, title }: { recId: string; title: string }) {
  const [fb, setFb] = useState<Feedback>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const send = (next: Feedback) => start(async () => {
    setError("");
    const r = await rateRec(recId, next);
    if (r.error) setError(r.error); else setFb(next);
  });
  if (fb === "down" || fb === "dismissed") {
    return <p className={s.note} role="status">Gone, and it won&apos;t come back. <button className={s.link} onClick={() => send(null)} disabled={pending}>Undo</button></p>;
  }
  return (
    <span className={s.row}>
      <button className={s.btn} aria-pressed={fb === "up"} aria-label={`More like ${title}`} onClick={() => send(fb === "up" ? null : "up")} disabled={pending}>▲ More like this</button>
      <button className={s.btn} aria-label={`Not for me: ${title}`} onClick={() => send("down")} disabled={pending}>✕ Not for me</button>
      {error && <span className={s.error} role="alert">{error}</span>}
    </span>
  );
}

export function WishButton({ slug, on, title, big = false }: { slug: string; on: boolean; title: string; big?: boolean }) {
  const [wished, setWished] = useState(on);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const flip = () => start(async () => {
    setError("");
    const r = await setWish(slug, !wished);
    if (r.error) setError(r.error); else setWished(!wished);
  });
  return (
    <span className={s.row}>
      <button className={big ? "btn" : s.btn} aria-pressed={wished} aria-label={wished ? `Take ${title} off the wishlist` : `Add ${title} to the wishlist`} onClick={flip} disabled={pending}>
        {wished ? "✓ On the wishlist" : "+ Add to wishlist"}
      </button>
      {error && <span className={s.error} role="alert">{error}</span>}
    </span>
  );
}

/** Wishlist straight from TMDB: saves the title to the store (off the shelves) first. */
export function WishTmdbButton({ kind, tmdbId, title }: { kind: "movie" | "tv"; tmdbId: number; title: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const add = () => start(async () => {
    setError("");
    const r = await wishTmdb(kind, tmdbId);
    if (r.error) setError(r.error); else { setDone(true); router.refresh(); }
  });
  return (
    <span className={s.row}>
      <button className={s.btn} onClick={add} disabled={pending || done} aria-label={`Add ${title} to the wishlist`}>{done ? "✓ Wishlisted" : pending ? "Adding…" : "+ Wishlist"}</button>
      {error && <span className={s.error} role="alert">{error}</span>}
    </span>
  );
}
