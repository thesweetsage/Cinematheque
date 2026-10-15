import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./supabase";
import { articleFor } from "./notes/wikipedia";

/*
 * The edition essay: the booklet tucked inside a numbered edition, about 400-600 words. What it is, why it matters,
 * what to notice, and the member's own take. Written by Claude from the title's Wikipedia article, its TMDB details,
 * its checked liner notes and the member's own ratings and notes only. Saved as a draft; the member edits it, then marks it checked.
 */

export const ESSAY_MODEL = "claude-opus-5-5";
export const canWriteEssay = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEM = `You write the essay printed in the booklet of a numbered "edition" in a small personal video store: the member's hall of fame, in the spirit of a Criterion booklet.

Write 400 to 600 words of plain prose in 4 to 6 paragraphs separated by blank lines, no headings or lists. Cover what the film or series is, why it matters, and what to notice while watching. Don't reveal the ending or late twists.

Use only the facts in the sources you're given: the Wikipedia article, the TMDB details and the store's liner notes. If something isn't in the sources, leave it out. Never add facts, dates, names, numbers or quotes from memory.

The last paragraph is the member's own take, written in the first person ("I"), and only from their rating and notes. If they have left no notes, end instead with one short sentence asking what they make of it, and don't invent an opinion for them.`;

const inFlight = new Map<string, Promise<void>>();

/** Writes (or rewrites) the essay for an edition. Concurrent calls for the same edition share one run. */
export function writeEssay(editionSlug: string): Promise<void> {
  const running = inFlight.get(editionSlug);
  if (running) return running;
  const run = doWrite(editionSlug).finally(() => inFlight.delete(editionSlug));
  inFlight.set(editionSlug, run);
  return run;
}

async function doWrite(editionSlug: string) {
  if (!canWriteEssay()) throw new Error("Add ANTHROPIC_API_KEY to .env.local to write essays.");
  const client = db();
  if (!client) throw new Error("The database isn't connected.");
  const { data: p, error } = await client.from("programmes").select("id, programme_items(title_id)").eq("slug", editionSlug).eq("type", "edition").maybeSingle();
  if (error) throw new Error(error.message);
  const titleId = (p as { programme_items: { title_id: string }[] } | null)?.programme_items[0]?.title_id;
  if (!p || !titleId) throw new Error("That edition isn't in the store.");

  const [{ data: t }, { data: notes }, { data: watches }] = await Promise.all([
    client.from("titles").select("kind, title, year, imdb_id, director_or_creator, cast_names, genres, country, overview").eq("id", titleId).single(),
    client.from("title_notes").select("liner_notes, status").eq("title_id", titleId).maybeSingle(),
    client.from("watches").select("rating, note, watched_at").eq("title_id", titleId).order("watched_at", { ascending: false }),
  ]);
  const title = t as { kind: string; title: string; year: number | null; imdb_id: string | null; director_or_creator: string | null; cast_names: string[]; genres: string[]; country: string | null; overview: string | null };
  const article = title.imdb_id ? await articleFor(title.imdb_id).catch(() => null) : null;
  const liner = (notes as { liner_notes: string | null; status: string } | null);
  if (!article && !liner?.liner_notes) throw new Error("No Wikipedia article or liner notes for this title, so there's nothing to write the essay from.");

  const details = [
    `Title: ${title.title}${title.year ? ` (${title.year})` : ""}, ${title.kind === "series" ? "series" : "film"}`,
    title.director_or_creator && `${title.kind === "series" ? "Created by" : "Directed by"}: ${title.director_or_creator}`,
    title.cast_names.length && `Cast: ${title.cast_names.join(", ")}`,
    title.genres.length && `Genres: ${title.genres.join(", ")}`,
    title.country && `Country: ${title.country}`,
    title.overview && `Synopsis: ${title.overview}`,
  ].filter(Boolean).join("\n");
  const w = (watches ?? []) as { rating: number | null; note: string | null; watched_at: string }[];
  const member = [
    `Watched ${w.length} time${w.length === 1 ? "" : "s"}`,
    w.find((x) => x.rating)?.rating && `Their rating: ${w.find((x) => x.rating)!.rating} of 5 stars`,
    ...w.filter((x) => x.note).map((x) => `Their note: ${x.note}`),
  ].filter(Boolean).join("\n");

  const sources = [
    article && `<wikipedia_article title="${article.title}">\n${article.text}\n</wikipedia_article>`,
    `<tmdb_details>\n${details}\n</tmdb_details>`,
    liner?.liner_notes && liner.status === "checked" && `<liner_notes>\n${liner.liner_notes}\n</liner_notes>`,
    `<member>\n${member}\n</member>`,
  ].filter(Boolean).join("\n\n");

  const anthropic = new Anthropic();
  const response = await anthropic.beta.messages.create({
    model: ESSAY_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [{ role: "user", content: `${sources}\n\nWrite the edition essay for ${title.title}. Reply with the essay text only.` }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to write this essay.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room before finishing. Try again.");
  const text = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (text.split(/\s+/).length < 200) throw new Error("The essay came back too short. Try again.");
  const { error: saveError } = await client.from("programmes").update({ essay: text, essay_status: "draft" }).eq("slug", editionSlug);
  if (saveError) throw new Error(saveError.message);
}
