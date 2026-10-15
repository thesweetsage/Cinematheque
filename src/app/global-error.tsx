"use client";

/* Last resort when the layout itself fails: plain page with the message, so it's never just white. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0B0920", color: "#EFEBFC", fontFamily: "Arial Narrow, Arial, sans-serif", padding: 40 }}>
        <h1>This tape won&apos;t play</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error.message || "No message"}{error.digest ? `\nCode: ${error.digest} (search the PowerShell window for it)` : ""}</pre>
        <button onClick={() => retry()} autoFocus style={{ fontSize: 20, padding: "8px 16px" }}>Try again</button>
      </body>
    </html>
  );
}
