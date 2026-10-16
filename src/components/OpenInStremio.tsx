"use client";
import { useState } from "react";

/*
 * Open in Stremio: opens the title in the Stremio app (stremio:///detail/...) by its IMDb id. In the store it first
 * leaves a note, so next time the app is opened it asks "Did you finish it?" (Stremio can't tell us).
 */
export function OpenInStremio({ slug, imdbId, kind, live }: { slug: string; imdbId: string; kind: "movie" | "series"; live: boolean }) {
  const [busy, setBusy] = useState(false);
  const href = `stremio:///detail/${kind}/${imdbId}`;
  const open = async (e: React.MouseEvent) => {
    if (!live) return; // the plain link does it
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "open", slug }), keepalive: true });
    } catch {}
    setBusy(false);
    location.href = href;
  };
  return <a className="btn" href={href} onClick={open} aria-busy={busy || undefined}>{busy ? "Opening…" : "Open in Stremio"}</a>;
}
