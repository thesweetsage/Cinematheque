import { after } from "next/server";
import { syncOnce } from "@/lib/plex/sync";
import { webhookKeyOk } from "@/lib/plex/webhook";

/*
 * POST /api/plex/webhook/<key> : Plex's webhook (multipart, with a JSON "payload" field). When something is watched
 * to the end (media.scrobble), or marked watched, the library syncs right after the reply, so watches are logged and
 * programme items tick within a minute. Anything else is acknowledged and ignored.
 */
const EVENTS = new Set(["media.scrobble", "library.new"]);

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!webhookKeyOk(key)) return new Response("Not found", { status: 404 });
  let event = "";
  try {
    const form = await request.formData();
    event = (JSON.parse(String(form.get("payload") ?? "{}")) as { event?: string }).event ?? "";
  } catch { return new Response("Bad payload", { status: 400 }); }
  if (EVENTS.has(event)) after(() => syncOnce().catch((e) => console.error("[plex] webhook sync failed:", (e as Error).message)));
  return new Response(null, { status: 204 });
}
