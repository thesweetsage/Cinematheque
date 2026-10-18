/* The v2 programme kinds on "Start a programme", each with its own form at /programmes/new/<kind>. */
export const KINDS: Record<string, { title: string; lede: string }> = {
  marathon: { title: "Series marathon", lede: "Finish a series you keep dropping: its episodes split into portions, a few a day or a week, on a marathon card. The Store Front nudges you when you fall behind." },
  curriculum: { title: "Curriculum", lede: "A whole viewing course from a list you trust, like every film in In Search of Darkness. Paste the list; it's sorted into chapters and matched on TMDB, then goes on the Course Shelf." },
  retrospective: { title: "Director retrospective", lede: "A director's films in the order they came out, on the Director's Shelf, with a staff card of themes to watch for and a Top 10 chalkboard you rank as you go." },
  "family-tree": { title: "Family tree", lede: "A title in the middle, what inspired it on one side and what it influenced on the other. Claude suggests branches from Wikipedia; you verify them and note what you noticed." },
  year: { title: "Year in a decade", lede: "One year (1974, 1997…) as a month-long programme: films and series from that year, plus what was on the radio, in the news and being worn." },
  essays: { title: "Essay series", lede: "One title per era with an essay on each. Start the Final Girls Archive (horror's heroines decade by decade), or an empty series of your own." },
};
