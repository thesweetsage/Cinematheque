import "server-only";
import { saveOffShelf } from "../importTitle";
import { articleFor } from "../notes/wikipedia";
import { details, directed } from "../tmdb";
import { askText, client, hasClaude, pool, saveProgramme, setExtras } from "./common";

/*
 * Director retrospective: a filmography as a course. Every feature film the director made that has come out, in the
 * order they came out, on the Director's Shelf; a staff card of themes to watch for, written by Claude from the
 * director's Wikipedia article only (a draft until checked); and a Top 10 chalkboard the member ranks as they watch.
 */

const MAX_FILMS = 40;

export async function buildRetrospective(personId: number): Promise<string> {
  if (!process.env.TMDB_API_KEY) throw new Error("Add TMDB_API_KEY to .env.local: filmographies come from TMDB.");
  const f = await directed(personId);
  if (!f.films.length) throw new Error(`TMDB has no released films directed by ${f.name}.`);
  // Feature films only: shorts and TV credits that slip into the list are left out.
  const kept: (string | null)[] = new Array(f.films.length).fill(null);
  await pool(f.films.slice(0, MAX_FILMS * 2), 4, async (film, i) => {
    const d = await details("movie", film.tmdbId).catch(() => null);
    if (!d || (d.runtime != null && d.runtime < 60)) return;
    try { kept[i] = (await saveOffShelf("movie", film.tmdbId)).id; } catch (e) { console.error(`[retrospective] couldn't save ${film.title}:`, (e as Error).message); }
  });
  const films = f.films.map((film, i) => ({ film, id: kept[i] })).filter((x): x is { film: typeof x.film; id: string } => !!x.id).slice(0, MAX_FILMS);
  if (!films.length) throw new Error(`Couldn't find any feature films by ${f.name}.`);
  const first = films[0].film.date.slice(0, 4), last = films[films.length - 1].film.date.slice(0, 4);
  const slug = await saveProgramme({
    type: "retrospective", title: `${f.name}: a retrospective`, status: "live", accent: "#FF9A5C",
    theme: `${films.length} film${films.length === 1 ? "" : "s"} in the order they came out${first === last ? `, ${first}` : `, ${first} to ${last}`}.`,
    extras: { person: { id: f.id, name: f.name, imdb: f.imdbId } },
  }, films.map(({ film, id }) => ({ titleId: id, chapter: `${film.date.slice(0, 3)}0s` })));
  if (hasClaude()) await writeThemes(slug).catch((e) => console.error("[retrospective] themes:", (e as Error).message));
  return slug;
}

const SYSTEM = `You write the staff card pinned to a director's shelf in a small personal video store: "Themes to watch for", in a friendly handwritten-card voice.

Write 70 to 130 words: 3 to 5 short sentences or fragments, each naming a theme, motif or habit of style to look out for across the films, plain text with line breaks between them, no headings, no bullets, no endings revealed.

Use only what the Wikipedia article you're given says. Never add films, names, dates or claims from memory. If the article says little about style or themes, write fewer lines rather than inventing any.`;

/** Writes (or rewrites) the themes staff card from the director's Wikipedia article. */
export async function writeThemes(slug: string) {
  if (!hasClaude()) throw new Error("Add ANTHROPIC_API_KEY to .env.local to write the staff card.");
  const { data, error } = await client().from("programmes").select("extras").eq("slug", slug).eq("type", "retrospective").maybeSingle();
  if (error) throw new Error(error.message);
  const person = (data as { extras: { person?: { name: string; imdb?: string | null } } } | null)?.extras?.person;
  if (!person) throw new Error("That retrospective isn't in the store.");
  const article = person.imdb ? await articleFor(person.imdb).catch(() => null) : null;
  if (!article) throw new Error(`No Wikipedia article found for ${person.name}, so there's nothing to write the card from.`);
  const text = await askText(SYSTEM, `<wikipedia_article title="${article.title}">\n${article.text.slice(0, 60000)}\n</wikipedia_article>\n\nWrite the "Themes to watch for" card for ${person.name}'s films. Reply with the card text only.`, "low");
  await setExtras(slug, { themes: { text: text.trim(), draft: true, source: article.url } });
}
