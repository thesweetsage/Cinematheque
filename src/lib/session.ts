/*
 * The membership session: a signed cookie set after Supabase Auth has confirmed the member's email.
 * Checked locally on every request (no call to Supabase), so the TV box stays signed in and pages stay fast.
 * Signed with SESSION_SECRET, or a key derived from SUPABASE_SECRET_KEY when that isn't set.
 */
export const SESSION_COOKIE = "cine_member";
export const SESSION_DAYS = 365;
const RENEW_AFTER_DAYS = 30;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

/** The one email allowed in. Login is off until it's set. */
export const memberEmail = () => process.env.MEMBER_EMAIL?.trim().toLowerCase() || null;

/** The gate is on once Supabase is connected (that's when there's anything to protect). */
export const gateOn = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

let keyPromise: Promise<CryptoKey> | null = null;
function key() {
  keyPromise ??= (async () => {
    const raw = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
    if (!raw) throw new Error("No SESSION_SECRET or SUPABASE_SECRET_KEY to sign sessions with");
    // Derive a dedicated key, so the cookie signature never exposes anything about the Supabase key.
    const base = await crypto.subtle.importKey("raw", enc.encode(raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const derived = await crypto.subtle.sign("HMAC", base, enc.encode("cinematheque member session v1"));
    return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  })();
  return keyPromise;
}

type Payload = { e: string; iat: number };

export async function createSession(email: string) {
  const body = b64url(enc.encode(JSON.stringify({ e: email.toLowerCase(), iat: Date.now() } satisfies Payload)));
  const sig = b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${sig}`;
}

/** Checks a cookie value. `renew` is true when it's old enough to be reissued. */
export async function readSession(value: string | undefined): Promise<{ email: string; renew: boolean } | null> {
  const member = memberEmail();
  if (!value || !member) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), Buffer.from(sig, "base64url"), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    const age = Date.now() - p.iat;
    // Changing MEMBER_EMAIL signs the old member out everywhere.
    if (p.e !== member || age < 0 || age > SESSION_DAYS * 86_400_000) return null;
    return { email: p.e, renew: age > RENEW_AFTER_DAYS * 86_400_000 };
  } catch {
    return null;
  }
}

export const cookieOptions = (secure: boolean) => ({
  httpOnly: true, sameSite: "lax" as const, path: "/", secure, maxAge: SESSION_DAYS * 86_400,
});

/** Only same-site paths after login. */
export const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/");
