"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/standorte", label: "Standorte" },
  { href: "/admin/tanzstile", label: "Tanzstile" },
  { href: "/admin/kurse", label: "Kurse" },
  { href: "/admin/videosaetze", label: "Videosätze" },
  { href: "/admin/kunden", label: "Kunden" },
  { href: "/admin/lehrer", label: "Lehrer" },
  { href: "/admin/buchungen", label: "Buchungen" },
  { href: "/admin/lastschriften", label: "Lastschriften" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b">
      {links.map((link) => {
        const active = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
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
