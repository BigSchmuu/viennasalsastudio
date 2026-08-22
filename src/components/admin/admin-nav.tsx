"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Music2,
  GraduationCap,
  CalendarDays,
  PlaySquare,
  Users,
  UserCog,
  ClipboardList,
  UserCheck,
  Mail,
  CreditCard,
  FileText,
  Bell,
  TicketPercent,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string; links: NavLink[] };

const groups: NavGroup[] = [
  { title: "Übersicht", links: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Programm",
    links: [
      { href: "/admin/kurse", label: "Kurse", icon: GraduationCap },
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/standorte", label: "Standorte", icon: MapPin },
      { href: "/admin/tanzstile", label: "Tanzstile", icon: Music2 },
      { href: "/admin/videosaetze", label: "Videosätze", icon: PlaySquare },
    ],
  },
  {
    title: "Personen",
    links: [
      { href: "/admin/kunden", label: "Kunden", icon: Users },
      { href: "/admin/lehrer", label: "Lehrer", icon: UserCog },
    ],
  },
  {
    title: "Buchungen",
    links: [
      { href: "/admin/buchungen", label: "Buchungen", icon: ClipboardList },
      { href: "/admin/probestunden", label: "Probestunden", icon: UserCheck },
    ],
  },
  {
    title: "Finanzen & Kommunikation",
    links: [
      { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
      { href: "/admin/benachrichtigungen", label: "Benachrichtigungen", icon: Bell },
      { href: "/admin/gutscheine", label: "Gutscheine", icon: TicketPercent },
      { href: "/admin/lastschriften", label: "Lastschriften", icon: CreditCard },
      { href: "/admin/rechnungen", label: "Rechnungen", icon: FileText },
    ],
  },
];

export function AdminNav({ openBookingsCount = 0 }: { openBookingsCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin-Navigation"
      className="flex items-center gap-3 overflow-x-auto rounded-2xl border bg-muted/40 p-1.5"
    >
      {groups.map((group, groupIndex) => (
        <div key={group.title} className="flex shrink-0 items-center gap-1">
          {groupIndex > 0 && <span className="mr-2 h-5 w-px shrink-0 bg-border" aria-hidden="true" />}
          {group.links.map((link) => {
            const active = link.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {link.label}
                {/* PROJ-39: only on Buchungen, and only when something is
                    actually waiting — a "0" badge would be pure noise. */}
                {link.href === "/admin/buchungen" && openBookingsCount > 0 && (
                  <span
                    aria-label={`${openBookingsCount} offene Buchungen`}
                    className={cn(
                      "ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                      active ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"
                    )}
                  >
                    {openBookingsCount > 99 ? "99+" : openBookingsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
