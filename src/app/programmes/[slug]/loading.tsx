/* Shown while a programme that wasn't prerendered (e.g. one just built) is pinned to the wall. */
export default function Loading() {
  return <p className="osd-label" role="status" style={{ paddingBlock: 40 }}>TRACKING…</p>;
}
