import Link from "next/link";

/* Not on the shelves: never a white page. A title or programme added a moment ago can take a minute to appear. */
export default function NotFound() {
  return (
    <section style={{ maxWidth: 760, paddingBlock: 30 }}>
      <div className="osd-label">404 · No tape in this slot</div>
      <h1 style={{ fontFamily: "var(--font-bungee)", fontWeight: 400, fontSize: "clamp(30px,4vw,48px)", lineHeight: 1, margin: "6px 0 14px" }}>Not on the shelves</h1>
      <p style={{ color: "var(--muted)", maxWidth: "60ch" }}>
        This page isn&apos;t in the store. If it was added a moment ago (a new programme, or a title from the Plex sync),
        give it a minute and try again.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <Link className="btn primary" href="/" data-autofocus>Back to the store front</Link>
        <Link className="btn" href="/programmes">Festival wall</Link>
      </div>
    </section>
  );
}
