/* Shown while a title that wasn't prerendered (e.g. one just added to the database) is pulled off the shelf. */
export default function Loading() {
  return <p className="osd-label" role="status" style={{ paddingBlock: 40 }}>TRACKING…</p>;
}
