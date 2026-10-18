"use server";
import { webhookKey } from "@/lib/plex/webhook";
import { after } from "next/server";
import { requireMember } from "@/lib/member";
import { missingTable } from "@/lib/settings";
import { checkPin, createPin, firstReachable, listServers, type ServerChoice } from "@/lib/plex/api";
import { plexServer, plexSettings, savePlexSettings, usingEnv } from "@/lib/plex/connection";
import { lastReport, syncOnce, syncState, type SyncReport } from "@/lib/plex/sync";

/* The Plex panel on the Membership card. Every action checks the member's session first. */

export type PlexStatus =
  | { state: "no-db" | "no-table" }
  | { state: "disconnected"; error?: string }
  | { state: "choose"; servers: { name: string; machineId: string }[] }
  | { state: "connected"; server: string; fromEnv: boolean; running: boolean; progress: string; last: SyncReport | null };

export async function plexStatus(): Promise<PlexStatus> {
  await requireMember();
  try {
    const s = await plexSettings();
    const server = await plexServer();
    if (server) {
      const st = syncState();
      return { state: "connected", server: server.name, fromEnv: server.source === "env", running: st.running, progress: st.progress, last: await lastReport() };
    }
    if (usingEnv()) return { state: "disconnected", error: "PLEX_URL and PLEX_TOKEN are set in .env.local, but that server doesn't answer." };
    if (s.accountToken) return { state: "choose", servers: (await servers()).map(({ name, machineId }) => ({ name, machineId })) };
    return { state: "disconnected" };
  } catch (e) {
    if (missingTable(e)) return { state: "no-table" };
    if (/isn't connected/.test((e as Error).message)) return { state: "no-db" };
    return { state: "disconnected", error: (e as Error).message };
  }
}

const g = globalThis as unknown as { __cinePin?: { id: number; code: string } };

/** Step 1: a code to type at plex.tv/link. */
export async function plexStartLink(): Promise<{ code: string } | { error: string }> {
  await requireMember();
  try {
    const pin = await createPin((await plexSettings()).clientId);
    g.__cinePin = { id: pin.id, code: pin.code };
    return { code: pin.code };
  } catch (e) { return { error: `Couldn't reach plex.tv: ${(e as Error).message}` }; }
}

/** Step 2 (polled): once the code is entered, keep the account and pick the server. */
export async function plexCheckLink(): Promise<{ waiting: true } | { status: PlexStatus } | { error: string }> {
  await requireMember();
  const pin = g.__cinePin;
  if (!pin) return { error: "Start again: the code has expired." };
  try {
    const s = await plexSettings();
    const res = await checkPin(s.clientId, pin.id);
    if (!res.authToken) return new Date(res.expiresAt) < new Date() ? { error: "The code expired. Ask for a new one." } : { waiting: true };
    g.__cinePin = undefined;
    await savePlexSettings({ ...s, accountToken: res.authToken, server: undefined });
    const list = await servers();
    // One server you own: pick it straight away.
    const owned = list.filter((x) => x.owned);
    if (owned.length === 1) {
      const picked = await pick(owned[0]);
      if (picked) return { error: picked };
    }
    return { status: await plexStatus() };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function plexChooseServer(machineId: string): Promise<{ error?: string }> {
  await requireMember();
  const choice = (await servers()).find((x) => x.machineId === machineId);
  if (!choice) return { error: "That server isn't on your Plex account any more." };
  const err = await pick(choice);
  return err ? { error: err } : {};
}

export async function plexSyncNow(): Promise<{ started: boolean }> {
  await requireMember();
  if (syncState().running) return { started: false };
  after(() => syncOnce());
  return { started: true };
}

export async function plexDisconnect() {
  await requireMember();
  const s = await plexSettings();
  await savePlexSettings({ clientId: s.clientId });
}

async function servers(): Promise<ServerChoice[]> {
  const s = await plexSettings();
  return s.accountToken ? listServers(s.clientId, s.accountToken) : [];
}

/** Saves a server with the first address that answers from here. Returns an error message, or null. */
async function pick(c: ServerChoice): Promise<string | null> {
  const url = await firstReachable(c.urls, c.token);
  if (!url) return `Found "${c.name}" on your Plex account, but couldn't reach it from this computer. Is the Plex server running?`;
  const s = await plexSettings();
  await savePlexSettings({ ...s, server: { name: c.name, machineId: c.machineId, url, token: c.token } });
  after(() => syncOnce()); // first sync straight away
  return null;
}

/** The Plex webhook's path (with its secret key), for instant tick-offs with Plex Pass. */
export async function plexWebhookPath(): Promise<string> {
  await requireMember();
  return `/api/plex/webhook/${webhookKey()}`;
}
