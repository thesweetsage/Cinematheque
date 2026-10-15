import "server-only";
import { randomUUID } from "node:crypto";
import { getSetting, setSetting } from "../settings";
import { identity, type Server } from "./api";

/*
 * The Plex connection, kept in app_settings (server side only). PLEX_URL + PLEX_TOKEN in .env.local
 * take over when both are set, for setups where signing in with a code isn't possible.
 */
export type PlexSettings = {
  clientId: string;
  accountToken?: string;
  server?: { name: string; machineId: string; url: string; token: string };
};
export type Connected = Server & { name: string; machineId: string; source: "settings" | "env" };

const KEY = "plex";

export async function plexSettings(): Promise<PlexSettings> {
  const s = await getSetting<PlexSettings>(KEY);
  if (s?.clientId) return s;
  const fresh = { clientId: randomUUID() };
  await setSetting(KEY, fresh);
  return fresh;
}
export const savePlexSettings = (s: PlexSettings) => setSetting(KEY, s);

const envServer = () => {
  const url = process.env.PLEX_URL?.trim(), token = process.env.PLEX_TOKEN?.trim();
  return url && token ? { url, token } : null;
};
let envMachine: { url: string; id: string | null } | null = null;

/** The server to sync from, or null when Plex isn't connected. */
export async function plexServer(): Promise<Connected | null> {
  const env = envServer();
  if (env) {
    if (envMachine?.url !== env.url || !envMachine.id) envMachine = { url: env.url, id: await identity(env) };
    return envMachine.id ? { ...env, name: "Plex (from .env.local)", machineId: envMachine.id, source: "env" } : null;
  }
  const s = (await getSetting<PlexSettings>(KEY))?.server;
  return s ? { url: s.url, token: s.token, name: s.name, machineId: s.machineId, source: "settings" } : null;
}

export const usingEnv = () => !!envServer();
