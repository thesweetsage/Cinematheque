"use server";
import { networkInterfaces } from "node:os";
import { headers } from "next/headers";
import { requireMember } from "@/lib/member";
import { addonToken } from "@/lib/stremio";

/**
 * The add-on's path (with its secret token), and this computer's address on the home network, for the Membership card.
 * Installed with the network address, the add-on syncs through the Stremio account to the TV box and works there too.
 */
export async function addonPath(): Promise<{ path: string; lan: string | null }> {
  await requireMember();
  const host = (await headers()).get("host") ?? "";
  const port = host.match(/:(\d+)$/)?.[1];
  const ip = Object.values(networkInterfaces()).flat()
    .find((n) => n && n.family === "IPv4" && !n.internal && /^(192\.168|10|172\.(1[6-9]|2\d|3[01]))\./.test(n.address))?.address;
  return { path: `/api/stremio/${addonToken()}/manifest.json`, lan: ip ? `http://${ip}${port ? `:${port}` : ""}` : null };
}
