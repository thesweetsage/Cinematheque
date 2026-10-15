/*
 * Runs once when the server starts. Sets up the hourly Plex sync (and the nightly recommendations run): a timer that asks this same server to sync
 * (through /api/plex/sync, so the sync runs like any request and can refresh the pages' cache).
 * The key below is made fresh on every start and never leaves this process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const g = globalThis as unknown as { __cineTimer?: NodeJS.Timeout };
  if (g.__cineTimer) return;
  process.env.CINE_TIMER_KEY = crypto.randomUUID();
  const tick = () => {
    const port = process.env.PORT || "3000";
    const call = (route: string, label: string) =>
      fetch(`http://127.0.0.1:${port}${route}`, { method: "POST", headers: { "x-cine-timer": process.env.CINE_TIMER_KEY! } })
        .then((r) => { if (!r.ok) console.error(`[${label}] timer call refused: ${r.status}`); })
        .catch((e) => console.error(`[${label}] timer call couldn't start:`, e.message));
    call("/api/plex/sync", "plex");
    // Recommendations: asked every hour, but the route only runs once the last good run is 20+ hours old (nightly).
    // Half an hour later, so a fresh sync's watches are in.
    setTimeout(() => call("/api/recs/run", "recs"), 30 * 60_000);
  };
  setTimeout(tick, 2 * 60_000); // shortly after start, then every hour
  g.__cineTimer = setInterval(tick, 60 * 60_000);
}
