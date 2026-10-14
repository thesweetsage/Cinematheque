import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import sampleTitles from "@/data/sample-titles.json";
import artData from "@/data/art.json";
import store from "@/data/sample-store.json";
import { brighten } from "./colour";

/* Sample catalogue for phase 1. Phase 2 swaps these loaders for Supabase reads; the shapes stay the same. */

export type Kind = "movie" | "series";
export type Title = {
  id: string; t: string; y: number; kind: Kind; g: string; dir: string; run?: string; lib: boolean;
  imdb?: number; rt?: number; mc?: number; my?: number; staff?: number; new?: number;
  cast?: string; ctry?: string; syn: string; seasons?: number[]; watched?: number[]; writer?: string; studio?: string;
};
export type Art = {
  poster: string | null; logo: string | null; backdrop: string | null;
  bg: string; accent: string; logoDark: boolean; logoRatio: number;
};
export type Rec = { id: string; why: string; who: string };

type RawArt = { tmdbId?: number; bg?: string; accent?: string; logo?: boolean; logoDark?: boolean; logoRatio?: number; backdrop?: boolean };
const RAW = artData as Record<string, RawArt>;
const TITLES = sampleTitles as Title[];
const BY_ID = new Map(TITLES.map((t) => [t.id, t]));

const fileExists = (rel: string) => existsSync(path.join(process.cwd(), "public", rel));

export function allTitles() { return TITLES; }
export function libraryTitles() { return TITLES.filter((t) => t.lib); }
export function getTitle(id: string) { return BY_ID.get(id); }

/** Artwork for a title. Paths are null when `npm run art` hasn't fetched that image yet. */
export function artFor(id: string): Art {
  const r = RAW[id] ?? {};
  const poster = `/art/posters/${id}.jpg`, logo = `/art/logos/${id}.png`, backdrop = `/art/backdrops/${id}.jpg`;
  return {
    poster: fileExists(poster) ? poster : null,
    logo: r.logo && fileExists(logo) ? logo : null,
    backdrop: r.backdrop && fileExists(backdrop) ? backdrop : null,
    bg: r.bg ?? "#14112f",
    accent: brighten(r.accent ?? "#b9b2ff"),
    logoDark: !!r.logoDark,
    logoRatio: r.logoRatio ?? 3,
  };
}

export const picks = store.picks as { id: string; why: string }[];
export const recs = store.recs as { pop: Rec[]; deep: Rec[] };
export const facts = store.facts as Record<string, { k: string; x: string }[]>;
export const editions = store.editions as Record<string, string>;

export function moreLikeThis(t: Title, n = 6) {
  return TITLES.filter((x) => x.id !== t.id && (x.g === t.g || x.dir === t.dir)).slice(0, n);
}

export const GENRES = ["HORROR", "ROM-COM", "FANTASY", "ANIME", "SERIES"] as const;
