import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Plex webhooks (Plex Pass): Plex calls /api/plex/webhook/<key> when something is watched, and the app syncs straight
 * away instead of waiting for the hourly sync, so programme items tick themselves within a minute. Plex can't sign
 * in, so the address carries a key derived from the server secret, like the Stremio add-on's.
 */
export function webhookKey() {
  const raw = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!raw) return "open";
  return createHmac("sha256", raw).update("cinematheque plex webhook v1").digest("base64url").slice(0, 24);
}
export function webhookKeyOk(key: string) {
  const want = Buffer.from(webhookKey()), got = Buffer.from(key);
  return want.length === got.length && timingSafeEqual(want, got);
}
