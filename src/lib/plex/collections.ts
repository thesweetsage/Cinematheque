import "server-only";
import { setExtras } from "../build/common";
import type { ProgExtras } from "../programmes";
import { db } from "../supabase";
import { plexRequest } from "./api";
import { plexServer } from "./connection";

/*
 * Plex collection sync: copies a programme into Plex as a collection (one per library section, since Plex keeps
 * collections per section), in programme order, so it can be played from Plex on any device. Running it again brings
 * the collection up to date: missing titles are added, removed ones taken out, the order fixed. Titles that aren't on
 * Plex are skipped. A marathon's collection holds its series.
 */

type Meta = { ratingKey: string; librarySectionID?: number | string };

export async function syncCollection(slug: string): Promise<{ count: number; skipped: number }> {
  const client = db();
  if (!client) throw new Error("The database isn't connected yet.");
  const server = await plexServer();
  if (!server) throw new Error("Connect Plex first (Membership card).");
  const { data: p, error } = await client.from("programmes").select("id, title, extras, programme_items(position, slot_date, titles(plex_rating_key, on_plex))").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("That programme isn't in the store.");
  type Row = { id: string; title: string; extras: ProgExtras; programme_items: { position: number; slot_date: string | null; titles: { plex_rating_key: string | null; on_plex: boolean } | null }[] };
  const prog = p as unknown as Row;
  const ordered = [...prog.programme_items].sort((a, b) => (a.slot_date ?? "9999").localeCompare(b.slot_date ?? "9999") || a.position - b.position);
  const keys = [...new Set(ordered.filter((i) => i.titles?.on_plex && i.titles.plex_rating_key).map((i) => i.titles!.plex_rating_key!))];
  const skipped = new Set(ordered.map((i) => i.titles?.plex_rating_key ?? `x${i.position}`)).size - keys.length;
  if (!keys.length) throw new Error("None of its titles are on Plex yet.");

  // Which library section each title lives in.
  const bySection = new Map<string, string[]>();
  for (const k of keys) {
    const m = await plexRequest<{ librarySectionID?: number | string; Metadata?: Meta[] }>(server, "GET", `library/metadata/${k}`);
    const sec = String(m?.librarySectionID ?? m?.Metadata?.[0]?.librarySectionID ?? "");
    if (sec) bySection.set(sec, [...(bySection.get(sec) ?? []), k]);
  }
  const uri = (ks: string[]) => `server://${server.machineId}/com.plexapp.plugins.library/library/metadata/${ks.join(",")}`;
  const sections: Record<string, string> = {};
  let count = 0;
  for (const [sec, ks] of bySection) {
    const sectionType = (await plexRequest<{ Directory?: { key: string; type: string }[] }>(server, "GET", "library/sections"))?.Directory?.find((d) => d.key === sec)?.type;
    const type = sectionType === "show" ? "2" : "1";
    let id = prog.extras.plex?.sections?.[sec] ?? null;
    if (id && !(await plexRequest(server, "GET", `library/metadata/${id}`))) id = null; // deleted in Plex since
    if (!id) {
      const made = await plexRequest<{ Metadata?: Meta[] }>(server, "POST", "library/collections", { type, title: prog.title, smart: "0", sectionId: sec, uri: uri(ks) });
      id = made?.Metadata?.[0]?.ratingKey ?? null;
      if (!id) throw new Error("Plex didn't create the collection.");
    } else {
      const have = ((await plexRequest<{ Metadata?: Meta[] }>(server, "GET", `library/collections/${id}/children`))?.Metadata ?? []).map((m) => m.ratingKey);
      const add = ks.filter((k) => !have.includes(k));
      if (add.length) await plexRequest(server, "PUT", `library/collections/${id}/items`, { uri: uri(add) });
      for (const k of have.filter((k) => !ks.includes(k))) {
        if ((await plexRequest(server, "DELETE", `library/collections/${id}/items/${k}`)) === null) await plexRequest(server, "DELETE", `library/collections/${id}/children/${k}`);
      }
      // Keep the name in step with the programme's (a rename here renames it there).
      await plexRequest(server, "PUT", `library/sections/${sec}/all`, { type: "18", id, "title.value": prog.title, "title.locked": "1" }).catch(() => null);
    }
    // Custom order: the programme's.
    await plexRequest(server, "PUT", `library/metadata/${id}/prefs`, { collectionSort: "2" }).catch(() => null);
    for (let i = 1; i < ks.length; i++) await plexRequest(server, "PUT", `library/collections/${id}/items/${ks[i]}/move`, { after: ks[i - 1] }).catch(() => null);
    sections[sec] = id;
    count += ks.length;
  }
  await setExtras(slug, { plex: { sections, syncedAt: new Date().toISOString(), count } });
  return { count, skipped: Math.max(0, skipped) };
}
