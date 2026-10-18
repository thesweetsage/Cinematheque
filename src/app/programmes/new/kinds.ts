/* The v2 programme kinds on "Start a programme", each with its own form at /programmes/new/<kind>. */
export const KINDS: Record<string, { title: string; lede: string }> = {
  marathon: { title: "Series marathon", lede: "Finish a series you keep dropping: its episodes split into portions, a few a day or a week, on a marathon card. The Store Front nudges you when you fall behind." },
  curriculum: { title: "Curriculum", lede: "A whole viewing course from a list you trust, like every film in In Search of Darkness. Paste the list; it's sorted into chapters and matched on TMDB, then goes on the Course Shelf." },
};
