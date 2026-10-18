import "server-only";
import { db } from "./supabase";

/*
 * Family trees read title_links in both directions, so a link written once shows on both titles' trees:
 *   kind "inspired":   from was inspired by to   (to is an ancestor of from)
 *   kind "influenced": from influenced to        (to is a descendant of from)
 * A title's ancestors are what it was inspired by, plus anything recorded as having influenced it; its descendants
 * are what it influenced, plus anything recorded as inspired by it.
 */

export type LinkKind = "inspired" | "influenced";
export type Node = { slug: string; note: string | null; verified: boolean; from: string; to: string; kind: LinkKind };
export type Tree = { ancestors: Node[]; descendants: Node[] };

type Row = { from_title_id: string; to_title_id: string; kind: LinkKind; note: string | null; verified: boolean };

/** Read fresh on every view (one or two dozen links at most). */
export async function treeOf(rootSlug: string): Promise<Tree> {
  const client = db();
  if (!client) return { ancestors: [], descendants: [] };
  const { data: root } = await client.from("titles").select("id").eq("slug", rootSlug).maybeSingle();
  if (!root) return { ancestors: [], descendants: [] };
  const id = (root as { id: string }).id;
  const [a, b] = await Promise.all([
    client.from("title_links").select("from_title_id, to_title_id, kind, note, verified").eq("from_title_id", id).in("kind", ["inspired", "influenced"]),
    client.from("title_links").select("from_title_id, to_title_id, kind, note, verified").eq("to_title_id", id).in("kind", ["inspired", "influenced"]),
  ]);
  const rows = [...((a.data ?? []) as Row[]), ...((b.data ?? []) as Row[])];
  const ids = [...new Set(rows.flatMap((r) => [r.from_title_id, r.to_title_id]))];
  const { data: titles } = ids.length ? await client.from("titles").select("id, slug").in("id", ids) : { data: [] };
  const slug = new Map(((titles ?? []) as { id: string; slug: string }[]).map((t) => [t.id, t.slug]));
  const ancestors: Node[] = [], descendants: Node[] = [];
  for (const r of rows) {
    const out = r.from_title_id === id;
    const other = slug.get(out ? r.to_title_id : r.from_title_id);
    if (!other) continue;
    const node = { slug: other, note: r.note, verified: r.verified, from: slug.get(r.from_title_id)!, to: slug.get(r.to_title_id)!, kind: r.kind };
    const isAncestor = (out && r.kind === "inspired") || (!out && r.kind === "influenced");
    (isAncestor ? ancestors : descendants).push(node);
  }
  const order = (x: Node[]) => x.sort((p, q) => Number(q.verified) - Number(p.verified) || p.slug.localeCompare(q.slug));
  return { ancestors: order(ancestors), descendants: order(descendants) };
}
