"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/standorte", label: "Standorte" },
  { href: "/admin/tanzstile", label: "Tanzstile" },
  { href: "/admin/kurse", label: "Kurse" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/videosaetze", label: "Videosätze" },
  { href: "/admin/kunden", label: "Kunden" },
  { href: "/admin/lehrer", label: "Lehrer" },
  { href: "/admin/buchungen", label: "Buchungen" },
  { href: "/admin/probestunden", label: "Probestunden" },
  { href: "/admin/lastschriften", label: "Lastschriften" },
  { href: "/admin/rechnungen", label: "Rechnungen" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {links.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
