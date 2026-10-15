import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../supabase";
import { articleFor, type Article } from "./wikipedia";

/*
 * Fact cards and liner notes for a title, written by Claude from the title's Wikipedia article and its TMDB details only.
 * Saved to title_notes as a draft; the member marks them checked. Server only: the API key never leaves the server.
 */

/** The plan asks for a smaller, cheaper model for fact cards and notes. */
export const NOTES_MODEL = "claude-sonnet-5-5";

export const canWrite = () => !!process.env.ANTHROPIC_API_KEY;

export type FactCard = { label: string; text: string; source: string };
type Written = { fact_cards: { label: string; text: string; section: string }[]; liner_notes: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fact_cards", "liner_notes"],
  properties: {
    fact_cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "text", "section"],
        properties: {
          label: { type: "string", description: "One or two words, e.g. Production, Casting, Release, Reception, Legacy, Music, Effects" },
          text: { type: "string", description: "One or two sentences" },
          section: { type: "string", description: "The exact Wikipedia section heading the fact comes from, or TMDB" },
        },
      },
    },
    liner_notes: { type: "string", description: "300 to 500 words in 3 to 5 paragraphs separated by blank lines" },
  },
};

const SYSTEM = `You write the booklet tucked inside a VHS box in a small personal video store: "Did you know?" fact cards and short liner notes for one film or series.

Use only the facts in the sources you're given: a Wikipedia article and the title's TMDB details. If something isn't in the sources, leave it out. Never add facts, dates, names, numbers or quotes from memory, and don't guess.

Fact cards: 4 to 6 of them, each one or two specific sentences, covering different ground (production, casting, release, reception, legacy and so on). Give each a short label and the exact Wikipedia section heading it came from (or "TMDB").

Liner notes: 300 to 500 words in 3 to 5 paragraphs, separated by blank lines. Give the context the title came out of, why it matters, and what to notice while watching. Plain prose, no headings or lists. Don't reveal the ending or late twists.

The member's own rating and notes, if given, are there for tone only. They are not facts about the title.`;

type TitleRow = {
  id: string; slug: string; kind: "movie" | "series"; title: string; year: number | null; imdb_id: string | null;
  director_or_creator: string | null; cast_names: string[]; genres: string[]; country: string | null; overview: string | null;
};

const inFlight = new Map<string, Promise<void>>();

/** Writes (or rewrites) a title's notes. Concurrent calls for the same title share one run. */
export function writeNotes(slug: string): Promise<void> {
  const running = inFlight.get(slug);
  if (running) return running;
  const run = doWrite(slug).finally(() => inFlight.delete(slug));
  inFlight.set(slug, run);
  return run;
}

async function doWrite(slug: string) {
  if (!canWrite()) throw new Error("Add ANTHROPIC_API_KEY to .env.local to write liner notes.");
  const client = db();
  if (!client) throw new Error("The database isn't connected.");
  const { data, error } = await client.from("titles")
    .select("id, slug, kind, title, year, imdb_id, director_or_creator, cast_names, genres, country, overview").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  const t = data as TitleRow | null;
  if (!t) throw new Error("That title isn't in the store.");
  if (!t.imdb_id) throw new Error("This title has no IMDb id, so its Wikipedia article can't be found.");

  const article = await articleFor(t.imdb_id);
  if (!article) throw new Error("No English Wikipedia article for this title, so there's nothing to write the notes from.");

  const { data: watches } = await client.from("watches").select("rating, note").eq("title_id", t.id).order("watched_at", { ascending: false });
  const rating = (watches ?? []).find((w) => w.rating)?.rating as number | undefined;
  const notes = (watches ?? []).map((w) => w.note as string | null).filter(Boolean);

  const written = await ask(t, article, rating, notes as string[]);
  const cards: FactCard[] = written.fact_cards.slice(0, 6).map((c) => ({
    label: c.label.trim(), text: c.text.trim(),
    source: c.section && c.section !== "TMDB" ? `${article.url}#${encodeURIComponent(c.section.trim().replace(/ /g, "_"))}` : article.url,
  }));
  const { error: saveError } = await client.from("title_notes").upsert({
    title_id: t.id, fact_cards: cards, liner_notes: written.liner_notes.trim(),
    sources: [`${article.url}?oldid=${article.revision}`], status: "draft", updated_at: new Date().toISOString(),
  });
  if (saveError) throw new Error(saveError.message);
}

async function ask(t: TitleRow, article: Article, rating: number | undefined, notes: string[]): Promise<Written> {
  const details = [
    `Title: ${t.title}${t.year ? ` (${t.year})` : ""}, ${t.kind === "series" ? "series" : "film"}`,
    t.director_or_creator && `${t.kind === "series" ? "Created by" : "Directed by"}: ${t.director_or_creator}`,
    t.cast_names.length && `Cast: ${t.cast_names.join(", ")}`,
    t.genres.length && `Genres: ${t.genres.join(", ")}`,
    t.country && `Country: ${t.country}`,
    t.overview && `Synopsis: ${t.overview}`,
  ].filter(Boolean).join("\n");
  const member = [rating && `Their rating: ${rating} of 5 stars`, ...notes.map((n) => `Their note: ${n}`)].filter(Boolean).join("\n");

  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: NOTES_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `<wikipedia_article title="${article.title}">\n${article.text}\n</wikipedia_article>\n\n<tmdb_details>\n${details}\n</tmdb_details>\n\n${member ? `<member>\n${member}\n</member>\n\n` : ""}Write the fact cards and liner notes for ${t.title}.`,
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to write notes for this title.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room before finishing. Try again.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude didn't return any notes.");
  const out = JSON.parse(text.text) as Written;
  if (!Array.isArray(out.fact_cards) || out.fact_cards.length < 3 || !out.liner_notes?.trim()) throw new Error("The notes came back incomplete. Try again.");
  return out;
}
