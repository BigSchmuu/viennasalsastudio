"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavLink = { href: string; label: string };

export function SiteHeader({
  isLoggedIn,
  isAdmin,
  isTeacher,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links: NavLink[] = [
    { href: "/kurse", label: "Kurse" },
    { href: "/stundenplan", label: "Stundenplan" },
    { href: "/events", label: "Events" },
    ...(isTeacher ? [{ href: "/lehrer", label: "Meine Kurse" }] : []),
    ...(isAdmin || isTeacher ? [{ href: "/checkin", label: "Check-in" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
    ...(isLoggedIn ? [{ href: "/profil", label: "Mein Profil" }] : [{ href: "/login", label: "Login" }]),
  ];

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-heading text-lg font-bold">
          Vienna Salsa Studio
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive(link.href)
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          {isLoggedIn && <LogoutButton />}
        </nav>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menü öffnen">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Menü</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 mt-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {isLoggedIn && (
                <div className="px-3 pt-2">
                  <LogoutButton />
                </div>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
