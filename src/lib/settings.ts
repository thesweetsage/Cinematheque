import "server-only";
import { db } from "./supabase";

/* Small JSON settings the app keeps in the `app_settings` table. */

export async function getSetting<T>(key: string): Promise<T | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown) {
  const client = db();
  if (!client) throw new Error("The database isn't connected yet.");
  const { error } = await client.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function deleteSetting(key: string) {
  const { error } = (await db()?.from("app_settings").delete().eq("key", key)) ?? { error: null };
  if (error) throw new Error(error.message);
}

/** True when the error means the settings table hasn't been created yet. */
export const missingTable = (e: unknown) => /app_settings/.test(String((e as Error)?.message)) && /does not exist|schema cache/.test(String((e as Error)?.message));
