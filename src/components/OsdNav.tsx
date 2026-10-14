"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./OsdNav.module.css";

const LINKS = [["/", "Store front"], ["/shelves", "Shelves"], ["/title/thing", "The box"], ["/settings", "Membership"]] as const;

export function OsdNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.split("/").slice(0, 2).join("/")));
  return (
    <header className={s.bar}>
      <div className={`wrap ${s.inner}`}>
        <Link href="/" className={s.logo} aria-label="The Cinematheque, store front"><b>VIDEO</b><i>Cinematheque</i></Link>
        <nav className={s.nav} aria-label="Pages">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
