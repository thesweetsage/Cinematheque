import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, gateOn, readSession } from "./session";

/** Server actions call this first: they're reachable by POST, so they check the session themselves. */
export async function requireMember() {
  if (!gateOn()) return;
  if (!(await readSession((await cookies()).get(SESSION_COOKIE)?.value))) throw new Error("Sign in first.");
}
