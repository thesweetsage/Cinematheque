import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Server-only Supabase client using the secret key. Row-level security has no policies, so the browser
 * (publishable key) can't read anything; every read and write goes through the app's server.
 * Returns null until NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are set, and the app falls back to sample data.
 */
let client: SupabaseClient | null | undefined;
export function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}
