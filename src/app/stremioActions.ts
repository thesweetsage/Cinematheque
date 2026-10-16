"use server";
import { requireMember } from "@/lib/member";
import { addonToken } from "@/lib/stremio";

/** The add-on's path (with its secret token), for the Membership card. */
export async function addonPath(): Promise<string> {
  await requireMember();
  return `/api/stremio/${addonToken()}/manifest.json`;
}
