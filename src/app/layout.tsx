import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Big_Shoulders, Bungee, VT323, IBM_Plex_Sans_Condensed, Mr_Dafoe, Permanent_Marker, Fraunces, Newsreader } from "next/font/google";
import { OsdNav } from "@/components/OsdNav";
import { RemoteNav } from "@/components/RemoteNav";
import { StoreRadio } from "@/components/StoreRadio";
import "./globals.css";

const shoulders = Big_Shoulders({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-shoulders" });
const bungee = Bungee({ subsets: ["latin"], weight: "400", variable: "--font-bungee" });
const vt323 = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt323" });
const plex = IBM_Plex_Sans_Condensed({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const script = Mr_Dafoe({ subsets: ["latin"], weight: "400", variable: "--font-script" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker" });
// Reading skin (liner notes, booklets)
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "The Cinematheque",
  description: "A personal 80s video store for everything on my Plex server.",
};
export const viewport: Viewport = { themeColor: "#0B0920", viewportFit: "cover" };

/*
 * No fetching pages ahead of time: a page fetched just before a change (a staff card hidden, a title wishlisted, a
 * programme thrown away) was shown afterwards as if nothing had changed. Every click gets the page fresh instead,
 * which on a home network is quick.
 */
export const prefetch = "force-disabled";

/* Settings live in localStorage; this runs before paint so TV mode and effects don't flash. */
const prefs = `try{var d=document.documentElement,tv=localStorage.getItem("cine_tv"),fx=localStorage.getItem("cine_fx");
if(tv==="1"||(tv===null&&matchMedia("(pointer:none)").matches))d.classList.add("tv");
if(fx!=="0"&&!matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("fx")}catch(e){}`;

/*
 * Every page renders fresh on each visit (one member, one machine: no need for saved page snapshots). The data underneath
 * is still cached ("use cache") and refreshed whenever something changes. Saved snapshots of pages with live parts were
 * being re-saved in the background and served half-finished (React error #412), or out of date (deleted programmes,
 * hidden staff cards coming back).
 */
async function Live({ children }: { children: React.ReactNode }) {
  await connection();
  return children;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fonts = [shoulders, bungee, vt323, plex, script, marker, fraunces, newsreader].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fonts} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: prefs }} /></head>
      <body>
        <Suspense fallback={null}><RemoteNav /></Suspense>
        <OsdNav />
        <main id="main" className="wrap" style={{ paddingBlock: "24px 40px" }}>
          <Suspense fallback={<p className="osd-label" role="status" style={{ paddingBlock: 40 }}>TRACKING…</p>}><Live>{children}</Live></Suspense>
        </main>
        <footer className="wrap" style={{ borderTop: "1px solid var(--edge)", paddingBlock: "22px 110px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          <span style={{ display: "block", fontFamily: "var(--font-script)", fontSize: 30, color: "#ffe0f3", textShadow: "0 0 10px var(--mag)" }}>Be kind, rewind.</span>
          Posters, logos and metadata from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
        </footer>
        <StoreRadio />
      </body>
    </html>
  );
}
