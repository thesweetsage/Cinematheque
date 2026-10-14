/* Shown on every screen while the app runs on the sample catalogue instead of the Plex library. Removed in phase 3. */
export function SampleTag() {
  return (
    <span style={{ fontFamily: "var(--font-vt323)", fontSize: 17, border: "1px dashed var(--muted)", color: "var(--muted)", padding: "1px 8px", whiteSpace: "nowrap" }}>
      SAMPLE DATA · NOT YOUR PLEX YET
    </span>
  );
}
