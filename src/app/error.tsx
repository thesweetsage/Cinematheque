"use client";
import Link from "next/link";
import { useEffect } from "react";

/*
 * Instead of a blank page: what broke, the error code to find in the PowerShell window (server errors print there with
 * the same digest), and a way back. Remote-friendly: two buttons, focus on the first.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section style={{ maxWidth: 760, paddingBlock: 30 }}>
      <div className="osd-label">Tracking error</div>
      <h1 style={{ fontFamily: "var(--font-bungee)", fontWeight: 400, fontSize: "clamp(30px,4vw,48px)", lineHeight: 1, margin: "6px 0 14px" }}>This tape won&apos;t play</h1>
      <p style={{ color: "var(--muted)" }}>Something broke while loading this page.</p>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-vt323)", fontSize: 19, background: "var(--panel)", border: "1px solid var(--edge)", padding: "10px 14px", marginTop: 14 }}>
        {error.message || "No message"}{error.digest ? `\nCode: ${error.digest} (search the PowerShell window for it)` : ""}
      </pre>
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn primary" onClick={() => retry()} autoFocus data-autofocus>Try again</button>
        <Link className="btn" href="/">Back to the store front</Link>
      </div>
    </section>
  );
}
