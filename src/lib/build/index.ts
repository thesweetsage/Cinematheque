import "server-only";
import { todayYmd } from "./common";
import { buildCurriculum } from "./curriculum";
import { buildMarathon } from "./marathon";

/* Checks a build request from the "Start a programme" forms and hands it to the right builder. Returns the slug. */

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ymd = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayYmd());

export async function buildV2(b: Record<string, unknown>): Promise<string> {
  switch (b.type) {
    case "marathon":
      return buildMarathon({ series: str(b.series), per: Number(b.per) || 1, unit: b.unit === "week" ? "week" : "day", start: ymd(b.start), skipWatched: b.skipWatched !== false });
    case "curriculum":
      return buildCurriculum({ title: str(b.title, 120), source: str(b.source, 200), text: str(b.text, 40000) });
    default:
      throw new Error("Unknown kind of programme.");
  }
}
