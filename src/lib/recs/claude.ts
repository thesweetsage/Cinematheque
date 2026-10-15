import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { lookupTitle, type Candidate } from "../tmdb";
import type { Profile } from "./profile";

/*
 * Claude's weekly deep cuts: 10 niche, older, foreign or overlooked titles with a reason each, written from the taste profile.
 * Every suggestion is looked up on TMDB by title and year; anything TMDB can't find is dropped, so nothing invented gets through.
 */

export const RECS_MODEL = "claude-opus-5-5";
export const canSuggest = () => !!process.env.ANTHROPIC_API_KEY;

type Suggestion = { title: string; year: number; kind: "movie" | "series"; reason: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "year", "kind", "reason"],
        properties: {
          title: { type: "string", description: "The title as it's listed on TMDB in English" },
          year: { type: "integer", description: "Release year (first air year for a series)" },
          kind: { type: "string", enum: ["movie", "series"] },
          reason: { type: "string", description: "One or two sentences, under 200 characters, tied to something in the profile" },
        },
      },
    },
  },
};

const SYSTEM = `You're a staff member at a small video store writing handwritten "deep cut" cards for one regular customer.

Suggest exactly 10 films or series they probably haven't seen: niche, older, foreign-language or overlooked titles, not the obvious famous ones. Ground every pick in their taste profile, and say why in the reason ("you rated three 70s folk horrors five stars"). Only cite things that are actually in the profile; don't invent their history.

Only suggest real titles you're confident exist, with the correct release year. Never suggest anything on their watched list. Mix decades and countries.`;

export async function claudeDeepCuts(profile: Profile, watched: string[]): Promise<{ kept: { c: Candidate; reason: string }[]; dropped: number }> {
  const lines = [
    `Titles watched: ${profile.watchedTitles}`,
    `Top genres: ${profile.genres.map(([g]) => g).join(", ")}`,
    `Recurring keywords: ${profile.keywords.map(([k]) => k).join(", ")}`,
    `Directors / creators: ${profile.directors.map(([d]) => d).join(", ")}`,
    `Decades: ${profile.decades.map(([d]) => `${d}s`).join(", ")}`,
    `Languages: ${profile.languages.map(([l]) => l).join(", ")}`,
    `Countries: ${profile.countries.map(([c]) => c).join(", ")}`,
    `Favourites lately: ${profile.seeds.map((s) => `${s.title}${s.rating ? ` (${s.rating}/5)` : ""}`).join("; ")}`,
    profile.finishedSeries.length && `Series finished: ${profile.finishedSeries.join(", ")}`,
    profile.droppedSeries.length && `Series dropped: ${profile.droppedSeries.join(", ")}`,
  ].filter(Boolean).join("\n");

  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: RECS_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `<taste_profile>\n${lines}\n</taste_profile>\n\n<watched>\n${watched.slice(0, 400).join("\n")}\n</watched>\n\nWrite this week's 10 deep cuts.`,
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to suggest deep cuts.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room before finishing.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude didn't return any suggestions.");
  const { suggestions } = JSON.parse(text.text) as { suggestions: Suggestion[] };

  const kept: { c: Candidate; reason: string }[] = [];
  let dropped = 0;
  for (const s of (suggestions ?? []).slice(0, 10)) {
    const c = await lookupTitle(s.kind === "series" ? "tv" : "movie", s.title, s.year).catch(() => null);
    if (c) kept.push({ c, reason: s.reason.trim() });
    else dropped++;
  }
  return { kept, dropped };
}
