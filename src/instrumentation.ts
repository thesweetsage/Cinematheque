/*
 * Runs once when the server starts. Sets up the hourly Plex sync: a timer that asks this same server to sync
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
    fetch(`http://127.0.0.1:${port}/api/plex/sync`, { method: "POST", headers: { "x-cine-timer": process.env.CINE_TIMER_KEY! } })
      .then((r) => { if (!r.ok) console.error(`[plex] hourly sync refused: ${r.status}`); })
      .catch((e) => console.error("[plex] hourly sync couldn't start:", e.message));
  };
  setTimeout(tick, 2 * 60_000); // shortly after start, then every hour
  g.__cineTimer = setInterval(tick, 60 * 60_000);
}
