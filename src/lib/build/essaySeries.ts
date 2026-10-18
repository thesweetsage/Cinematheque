import "server-only";
import { saveOffShelf } from "../importTitle";
import { articleFor } from "../notes/wikipedia";
import { lookupTitle } from "../tmdb";
import { askText, client, hasClaude, pool, saveProgramme } from "./common";

/*
 * Essay series: one title per era, one essay each, in order. The Final Girls Archive is the ready-made one: horror's
 * heroines decade by decade, each essay written by Claude from the film's Wikipedia article only (a draft until
 * checked). Any other series starts empty and is filled with Edit programme.
 */

/** The Final Girls Archive: the film, its year, and its heroine (shown as the item's note). */
export const FINAL_GIRLS: { title: string; year: number; heroine: string }[] = [
  { title: "The Texas Chain Saw Massacre", year: 1974, heroine: "Sally Hardesty" },
  { title: "Black Christmas", year: 1974, heroine: "Jess Bradford" },
  { title: "Halloween", year: 1978, heroine: "Laurie Strode" },
  { title: "Alien", year: 1979, heroine: "Ellen Ripley" },
  { title: "Friday the 13th", year: 1980, heroine: "Alice Hardy" },
  { title: "A Nightmare on Elm Street", year: 1984, heroine: "Nancy Thompson" },
  { title: "Scream", year: 1996, heroine: "Sidney Prescott" },
  { title: "The Descent", year: 2005, heroine: "Sarah Carter" },
  { title: "It Follows", year: 2014, heroine: "Jay Height" },
  { title: "Ready or Not", year: 2019, heroine: "Grace" },
  { title: "X", year: 2022, heroine: "Maxine Minx" },
];

export async function buildEssaySeries(ask: { preset: "final_girls" | "empty"; title: string }): Promise<string> {
  if (ask.preset === "empty") {
    const title = ask.title.trim();
    if (!title) throw new Error("Give the series a name.");
    return saveProgramme({ type: "essay_series", title, status: "live", accent: "#B9B2FF", theme: "One title per era, one essay each." }, []);
  }
  if (!process.env.TMDB_API_KEY) throw new Error("Add TMDB_API_KEY to .env.local: the films come from TMDB.");
  const ids: (string | null)[] = new Array(FINAL_GIRLS.length).fill(null);
  await pool(FINAL_GIRLS, 4, async (f, i) => {
    const c = await lookupTitle("movie", f.title, f.year).catch(() => null);
    if (c) ids[i] = await saveOffShelf("movie", c.tmdbId).then((t) => t.id).catch(() => null);
  });
  const items = FINAL_GIRLS.map((f, i) => ({ f, id: ids[i] })).filter((x): x is { f: (typeof FINAL_GIRLS)[number]; id: string } => !!x.id)
    .map(({ f, id }) => ({ titleId: id, chapter: `${Math.floor(f.year / 10) * 10}s`, note: f.heroine }));
  if (!items.length) throw new Error("Couldn't find the films on TMDB. Check the TMDB key.");
  return saveProgramme({
    type: "essay_series", title: "Final Girls Archive", status: "live", accent: "#FF4FB8",
    theme: `Horror's heroines, one per era: ${items.length} films from ${FINAL_GIRLS[0].year} to ${FINAL_GIRLS[FINAL_GIRLS.length - 1].year}, an essay on each.`,
  }, items);
}

const SYSTEM = `You write one essay in a series for a small personal video store's archive, about one film's heroine (or, if the series isn't about heroines, about the film's place in its era).

Write 250 to 400 words of plain prose in 3 to 5 paragraphs separated by blank lines, no headings or lists: who she is, how the film sets her up and sees her, what she does, and what the article says about her place in horror and her era. Don't reveal the ending or late twists.

Use only the facts in the Wikipedia article you're given. Never add facts, names, dates or quotes from memory. If the article says little about her, write a shorter essay rather than inventing.`;

/** Writes (or rewrites) the essay for one item of an essay series. */
export async function writeItemEssay(slug: string, position: number) {
  if (!hasClaude()) throw new Error("Add ANTHROPIC_API_KEY to .env.local to write essays.");
  const c = client();
  const { data: p, error } = await c.from("programmes").select("id, title").eq("slug", slug).eq("type", "essay_series").maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("That essay series isn't in the store.");
  const prog = p as { id: string; title: string };
  const { data: it } = await c.from("programme_items").select("title_id, programme_note").eq("programme_id", prog.id).eq("position", position).maybeSingle();
  const item = it as { title_id: string; programme_note: string | null } | null;
  if (!item) throw new Error("That title isn't in the series.");
  const { data: t } = await c.from("titles").select("title, year, imdb_id").eq("id", item.title_id).single();
  const title = t as { title: string; year: number | null; imdb_id: string | null };
  const article = title.imdb_id ? await articleFor(title.imdb_id).catch(() => null) : null;
  if (!article) throw new Error(`No Wikipedia article found for ${title.title}, so there's nothing to write the essay from.`);
  const text = await askText(SYSTEM, `<wikipedia_article title="${article.title}">\n${article.text.slice(0, 60000)}\n</wikipedia_article>\n\nSeries: ${prog.title}. Film: ${title.title}${title.year ? ` (${title.year})` : ""}.${item.programme_note ? ` Heroine: ${item.programme_note}.` : ""} Reply with the essay text only.`);
  if (text.split(/\s+/).length < 120) throw new Error("The essay came back too short. Try again.");
  const { error: e } = await c.from("programme_items").update({ essay: text.trim(), essay_status: "draft" }).eq("programme_id", prog.id).eq("position", position);
  if (e) throw new Error(e.message);
}
