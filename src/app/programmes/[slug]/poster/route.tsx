/* eslint-disable @next/next/no-img-element -- ImageResponse renders plain <img> */
import { ImageResponse } from "next/og";
import { artOf, findTitle, getCatalog } from "@/lib/catalog";
import { findProgramme, getProgrammes, TYPE_NAME } from "@/lib/programmes";

/*
 * GET /programmes/<slug>/poster : the festival poster generator. A 1200x1800 PNG of any programme: its name in Bungee,
 * the theme and dates, and up to nine of its covers (TMDB, credited), in the programme's colour. Download it, print
 * it, or use it as the artwork for its Plex collection.
 */

const fonts = new Map<string, Promise<ArrayBuffer | null>>();
/** A Google font as TTF (asked for without a browser user agent, Google answers with TrueType), or null offline. */
function font(family: string) {
  if (!fonts.has(family)) fonts.set(family, (async () => {
    try {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}`, { signal: AbortSignal.timeout(5000) })).text();
      const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
      return url ? await (await fetch(url, { signal: AbortSignal.timeout(8000) })).arrayBuffer() : null;
    } catch { return null; }
  })());
  return fonts.get(family)!;
}

const fmt = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [cat, progs] = await Promise.all([getCatalog(), getProgrammes()]);
  const p = findProgramme(progs, slug);
  if (!p) return new Response("Not found", { status: 404 });
  const posters = [...new Set(p.items.map((i) => i.id))].map((id) => findTitle(cat, id)).filter((t) => !!t)
    .map((t) => artOf(cat, t.id).poster).filter((u): u is string => !!u && u.startsWith("http")).slice(0, 9);
  const [plex, bungee, vt] = await Promise.all([font("IBM Plex Sans Condensed"), font("Bungee"), font("VT323")]);
  const acc = p.accent;
  const dates = p.start ? `${fmt(p.start)}${p.end && p.end !== p.start ? ` to ${fmt(p.end)}` : ""}` : "";
  // Up to four covers in a 2x2, five to nine in a 3x3, always inside the space between the title and the footer.
  const size = posters.length > 4 ? 205 : 310;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0B0920", color: "#EFEBFC", padding: 70, borderTop: `28px solid ${acc}`, fontFamily: "Plex" }}>
        <div style={{ display: "flex", fontFamily: "VT323", fontSize: 40, letterSpacing: 6, color: acc, textTransform: "uppercase" }}>The Cinematheque presents · {TYPE_NAME[p.type]}</div>
        <div style={{ display: "flex", fontFamily: "Bungee", fontSize: p.title.length > 24 ? 92 : 124, lineHeight: 1.02, marginTop: 30, textShadow: `0 0 30px ${acc}` }}>{p.title}</div>
        {p.theme && <div style={{ display: "flex", fontSize: 38, lineHeight: 1.3, marginTop: 28, color: "#C9C3EE", maxWidth: 1000 }}>{p.theme.slice(0, 180)}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 50, flex: 1, alignContent: "flex-start", justifyContent: "center", overflow: "hidden", width: posters.length > 4 ? 3 * (size + 8) + 48 : 2 * (size + 8) + 24, alignSelf: "center" }}>
          {posters.map((u) => <img key={u} src={u} width={size} height={size * 1.5} style={{ objectFit: "cover", border: `4px solid ${acc}` }} alt="" />)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: "VT323", fontSize: 36, color: "#A09ACB", borderTop: "2px solid #3A3471", paddingTop: 22 }}>
          <span style={{ display: "flex", fontFamily: "Bungee", fontSize: 44, color: "#7EE6FF" }}>VIDEO</span>
          <span style={{ display: "flex" }}>{dates}</span>
          <span style={{ display: "flex", fontSize: 26 }}>Posters: TMDB</span>
        </div>
      </div>
    ),
    {
      width: 1200, height: 1800,
      fonts: [plex && { name: "Plex", data: plex, weight: 400 as const, style: "normal" as const }, bungee && { name: "Bungee", data: bungee, weight: 400 as const, style: "normal" as const }, vt && { name: "VT323", data: vt, weight: 400 as const, style: "normal" as const }].filter((f) => !!f),
      headers: { "content-disposition": `inline; filename="${slug}-poster.png"`, "cache-control": "no-store" },
    },
  );
}
