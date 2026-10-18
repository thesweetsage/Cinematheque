"use server";
import { requireMember } from "@/lib/member";
import { getSetting, setSetting } from "@/lib/settings";
import { addonToken } from "@/lib/stremio";

export type AddonInfo = { path: string; cloud: string | null; cloudError?: string };

/**
 * Where the Stremio add-on can be installed from, for the Membership card:
 *  - cloud: the https address of the Supabase Edge Function (supabase/functions/stremio), once it's deployed.
 *    That's the one Stremio accepts from any device; the token it checks is saved here for it.
 *  - path: the app's own route, which Stremio only accepts on the same computer (http).
 */
export async function addonInfo(): Promise<AddonInfo> {
  await requireMember();
  const token = addonToken();
  const info: AddonInfo = { path: `/api/stremio/${token}/manifest.json`, cloud: null };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || token === "open") return info;
  try {
    const saved = await getSetting<{ token?: string }>("stremio");
    if (saved?.token !== token) await setSetting("stremio", { token });
    const cloud = `${base}/functions/v1/stremio/${token}/manifest.json`;
    const r = await fetch(cloud, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (r.ok && ((await r.json()) as { id?: string }).id) info.cloud = cloud;
    else info.cloudError = r.status === 404 ? "not deployed yet" : r.status === 401 ? "JWT verification is still on" : `answered ${r.status}`;
  } catch (e) {
    info.cloudError = (e as Error).message;
  }
  return info;
}
