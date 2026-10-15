"use client";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import s from "./OsdNav.module.css";

const LINKS = [["/", "Store front"], ["/shelves", "Shelves"], ["/library", "Library"], ["/programmes", "Festival wall"], ["/wishlist", "Coming soon"], ["/search", "Returns slot"], ["/settings", "Membership"]] as const;

/* The links, marked with the current page. They read the address, so they stream in (Suspense) and the rest of the
   page can still be built ahead of time; until then the same links show without the highlight. */
function Links() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.split("/").slice(0, 2).join("/")));
  return LINKS.map(([href, label]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>);
}

export function OsdNav() {
  return (
    <header className={s.bar}>
      <div className={`wrap ${s.inner}`}>
        <Link href="/" className={s.logo} aria-label="The Cinematheque, store front"><b>VIDEO</b><i>Cinematheque</i></Link>
        <nav className={s.nav} aria-label="Pages">
          <Suspense fallback={LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}><Links /></Suspense>
        </nav>
      </div>
    </header>
  );
}
