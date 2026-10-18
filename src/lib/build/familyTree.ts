import "server-only";
import { saveOffShelf } from "../importTitle";
import { articleFor } from "../notes/wikipedia";
import { lookupTitle, type TmdbKind } from "../tmdb";
import { askJson, client, hasClaude, pool, saveProgramme } from "./common";

/*
 * Family tree: a title plus what inspired it and what it influenced. The tree is a programme with the title as its
 * one item; the links live in title_links (see src/lib/familyTree.ts). Claude suggests links from the title's
 * Wikipedia article only, each checked on TMDB; they arrive unverified, and the member verifies or removes them and
 * adds notes on what they noticed. Links can also be added by hand.
 */

export async function buildFamilyTree(titleSlug: string): Promise<string> {
  const c = client();
  const { data: t, error } = await c.from("titles").select("id, title, year").eq("slug", titleSlug).maybeSingle();
  if (error) throw new Error(error.message);
  const title = t as { id: string; title: string; year: number | null } | null;
  if (!title) throw new Error("That title isn't in the store.");
  const slug = await saveProgramme({ type: "family_tree", title: `${title.title}: a family tree`, status: "live", accent: "#7EE6FF" }, [{ titleId: title.id }]);
  if (hasClaude()) await suggestLinks(titleSlug).catch((e) => console.error("[family tree] suggestions:", (e as Error).message));
  return slug;
}

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["links"],
  properties: {
    links: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["title", "year", "kind", "relation", "note"],
        properties: {
          title: { type: "string", description: "Its title as the article gives it" },
          year: { type: "integer", description: "Its year if the article gives one, else 0" },
          kind: { type: "string", enum: ["movie", "series"] },
          relation: { type: "string", enum: ["inspired_by", "influenced"], description: "inspired_by: the subject drew on it. influenced: it drew on the subject." },
          note: { type: "string", description: "What the article says about the connection, in under 140 characters" },
        },
      },
    },
  },
};

/** Asks Claude for links named in the title's Wikipedia article; each one found on TMDB is added, unverified. Returns how many. */
export async function suggestLinks(titleSlug: string): Promise<number> {
  if (!hasClaude()) throw new Error("Add ANTHROPIC_API_KEY to .env.local for suggestions.");
  const c = client();
  const { data: t } = await c.from("titles").select("id, title, year, imdb_id, kind").eq("slug", titleSlug).maybeSingle();
  const root = t as { id: string; title: string; year: number | null; imdb_id: string | null; kind: string } | null;
  if (!root) throw new Error("That title isn't in the store.");
  const article = root.imdb_id ? await articleFor(root.imdb_id).catch(() => null) : null;
  if (!article) throw new Error(`No Wikipedia article found for ${root.title}, so there's nothing to suggest links from.`);
  const out = await askJson<{ links: { title: string; year: number; kind: "movie" | "series"; relation: "inspired_by" | "influenced"; note: string }[] }>(
    "You build a film's family tree for a personal video store: the films and series it drew on, and the ones it went on to influence. List only works the Wikipedia article you're given names as an influence, inspiration, source, homage or remake, or as influenced by, inspired by, homaging or remaking the subject. Never add works from memory. Leave out books, plays, songs, games and people: films and series only. If the article names none, return an empty list.",
    `<wikipedia_article title="${article.title}">\n${article.text.slice(0, 60000)}\n</wikipedia_article>\n\nSubject: ${root.title}${root.year ? ` (${root.year})` : ""}. List its family tree links.`,
    SCHEMA,
  );
  let added = 0;
  await pool(out.links.slice(0, 24), 4, async (l) => {
    const kinds: TmdbKind[] = l.kind === "series" ? ["tv", "movie"] : ["movie", "tv"];
    for (const k of kinds) {
      const hit = await lookupTitle(k, l.title, l.year > 1800 ? l.year : null).catch(() => null);
      if (!hit) continue;
      try {
        const other = await saveOffShelf(k, hit.tmdbId);
        if (other.id === root.id) return;
        const { error, data } = await c.from("title_links").upsert({
          from_title_id: root.id, to_title_id: other.id, kind: l.relation === "inspired_by" ? "inspired" : "influenced",
          note: l.note.trim().slice(0, 200) || null, verified: false,
        }, { onConflict: "from_title_id,to_title_id,kind", ignoreDuplicates: true }).select("from_title_id");
        if (error) throw new Error(error.message);
        added += data?.length ?? 0;
      } catch (e) { console.error(`[family tree] couldn't add ${l.title}:`, (e as Error).message); }
      return;
    }
  });
  return added;
}
