import type { Catalog } from "@/lib/catalog";

const WHY: Record<NonNullable<Catalog["reason"]>, string> = {
  "not-connected": "DATABASE NOT CONNECTED",
  "no-access": "DATABASE REFUSED ACCESS",
  empty: "NO TITLES IN THE DATABASE YET",
};

/* Shown on every screen while the app runs on the sample catalogue instead of the database, with the reason. */
export function SampleTag({ catalog }: { catalog: Catalog }) {
  if (catalog.source !== "sample") return null;
  return (
    <span style={{ fontFamily: "var(--font-vt323)", fontSize: 17, border: "1px dashed var(--muted)", color: "var(--muted)", padding: "1px 8px", whiteSpace: "nowrap" }}>
      SAMPLE DATA · {WHY[catalog.reason ?? "not-connected"]}
    </span>
  );
}
