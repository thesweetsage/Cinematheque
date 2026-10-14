"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { SESSION_COOKIE, cookieOptions, createSession, gateOn, memberEmail, safeNext } from "@/lib/session";

/*
 * Sign-in at the counter. Supabase Auth emails a one-time code (type it with the remote) and a link
 * (tap it on a phone or laptop). Only MEMBER_EMAIL gets in; then the app keeps its own year-long session cookie.
 */
export type Result = { ok: boolean; msg: string };

function auth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" } }).auth;
}

function notReady(): Result | null {
  if (!gateOn()) return { ok: false, msg: "The database isn't connected, so there's nothing to sign in to yet." };
  if (!memberEmail()) return { ok: false, msg: "Set MEMBER_EMAIL in .env.local to the email that may sign in, then restart the app." };
  return null;
}

async function admit(email: string | undefined, next: string): Promise<Result> {
  if (!email || email.toLowerCase() !== memberEmail()) return { ok: false, msg: "That email isn't the member's." };
  const origin = (await headers()).get("origin") ?? "";
  (await cookies()).set(SESSION_COOKIE, await createSession(email), cookieOptions(origin.startsWith("https:")));
  redirect(safeNext(next));
}

export async function sendCode(email: string, next: string): Promise<Result> {
  const stop = notReady();
  if (stop) return stop;
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, msg: "That doesn't look like an email address." };
  // Same answer either way, so the form doesn't reveal which email is the member's.
  const sent: Result = { ok: true, msg: `If ${e} is the member email, a code is on its way.` };
  if (e !== memberEmail()) return sent;
  const origin = (await headers()).get("origin");
  const { error } = await auth().signInWithOtp({ email: e, options: { shouldCreateUser: true, emailRedirectTo: origin ? `${origin}/login?next=${encodeURIComponent(safeNext(next))}` : undefined } });
  if (error) return { ok: false, msg: error.status === 429 ? "Too many emails for now. Wait a while, or use the last code you got." : `Couldn't send the email: ${error.message}` };
  return sent;
}

export async function verifyCode(email: string, code: string, next: string): Promise<Result> {
  const stop = notReady();
  if (stop) return stop;
  const token = code.replace(/\D/g, "");
  if (token.length < 6) return { ok: false, msg: "The code is the 6 or more digits in the email." };
  const { data, error } = await auth().verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" });
  if (error || !data.user) return { ok: false, msg: "That code didn't work. It may have expired: ask for a new one." };
  return admit(data.user.email, next);
}

/** The email link lands back on /login with the Supabase session in the URL fragment; the page hands the token here. */
export async function finishLink(accessToken: string, next: string): Promise<Result> {
  const stop = notReady();
  if (stop) return stop;
  const { data, error } = await auth().getUser(accessToken);
  if (error || !data.user) return { ok: false, msg: "That sign-in link has expired. Ask for a new code." };
  return admit(data.user.email, next);
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
