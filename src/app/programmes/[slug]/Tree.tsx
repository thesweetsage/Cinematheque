import Link from "next/link";
import { VhsBox } from "@/components/VhsBox";
import { artOf, findTitle, type Catalog } from "@/lib/catalog";
import { treeOf, type Node } from "@/lib/familyTree";
import type { Programme, Programmes } from "@/lib/programmes";
import { AddBranch, NodeTools, SuggestBranches } from "../client";
import s from "../programmes.module.css";

/*
 * The family tree: a dark grid, the title's box in the middle, what inspired it on the left joined by cyan neon,
 * what it influenced on the right joined by magenta. Suggested branches are dashed until verified.
 */
export async function Tree({ p, cat, progs, live, canSuggest }: { p: Programme; cat: Catalog; progs: Programmes; live: boolean; canSuggest: boolean }) {
  const root = p.items[0] && findTitle(cat, p.items[0].id);
  if (!root) return <p className={s.lede}>This tree&apos;s title is gone from the store.</p>;
  const tree = await treeOf(root.id);
  const treeFor = (slug: string) => progs.list.find((x) => x.type === "family_tree" && x.items[0]?.id === slug);
  const node = (n: Node, side: "anc" | "desc", i: number) => {
    const t = findTitle(cat, n.slug);
    if (!t) return null;
    const own = treeFor(t.id);
    return (
      <li key={`${n.slug}-${n.kind}`} className={`${s.node} ${n.verified ? s.nodeOn : ""}`} data-side={side}>
        <Link href={`/title/${t.id}`} className={s.nodeBox} aria-label={`${t.t}${t.y ? `, ${t.y}` : ""}${n.verified ? "" : ", suggested"}`} data-autofocus={side === "anc" && i === 0 ? true : undefined}>
          <VhsBox title={t} art={artOf(cat, t.id)} width={84} wear="mint" />
        </Link>
        <div className={s.nodeText}>
          <b>{t.t} <small>{t.y || ""}</small></b>
          {!n.verified && <span className={s.nodeTag}>Suggested · check it</span>}
          {n.note && <span className={s.nodeNote}>{n.note}</span>}
          <span className={s.nodeLinks}>{own ? <Link href={`/programmes/${own.slug}`}>Its tree ▶</Link> : live ? <Link href={`/programmes/new/family-tree?title=${encodeURIComponent(t.id)}`}>Draw its tree ▶</Link> : null}</span>
          {live && <NodeTools link={{ from: n.from, to: n.to, kind: n.kind }} verified={n.verified} note={n.note} label={t.t} />}
        </div>
      </li>
    );
  };
  return (
    <>
      <h1 className={s.h1}>{p.title}</h1>
      <p className={s.lede}>What inspired {root.t}, and what it went on to influence. <span className={s.legend}><i className={s.legCyan} /> inspired by <i className={s.legMag} /> influenced</span></p>
      <div className={s.tree}>
        <section className={s.treeCol} data-side="anc" aria-label="Inspired by">
          <h2 className={s.treeHead}>Inspired by</h2>
          {tree.ancestors.length ? <ol className={s.nodes}>{tree.ancestors.map((n, i) => node(n, "anc", i))}</ol> : <p className={s.muted}>Nothing yet.</p>}
        </section>
        <div className={s.treeRoot}>
          <Link href={`/title/${root.id}`} aria-label={`Open the box: ${root.t}`} data-autofocus={!tree.ancestors.length ? true : undefined}><VhsBox title={root} art={artOf(cat, root.id)} width={170} wear="mint" kase="clam" /></Link>
          <b>{root.t}</b><small>{root.y || ""}</small>
        </div>
        <section className={s.treeCol} data-side="desc" aria-label="Influenced">
          <h2 className={s.treeHead}>Influenced</h2>
          {tree.descendants.length ? <ol className={s.nodes}>{tree.descendants.map((n, i) => node(n, "desc", i))}</ol> : <p className={s.muted}>Nothing yet.</p>}
        </section>
      </div>
      {live && (
        <section className={s.section} aria-label="Grow the tree">
          <h2 className="sec-title">Grow the tree</h2>
          {canSuggest && <div className={s.btns}><SuggestBranches title={root.id} /></div>}
          <AddBranch root={root.id} titles={cat.titles.map((t) => ({ id: t.id, t: t.t, y: t.y, lib: t.lib, plex: t.plex }))} />
        </section>
      )}
    </>
  );
}
