"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavLink = {
  href: string;
  label: string;
  /**
   * Mitarbeiterbereich (PROJ-43): /admin, /lehrer und /checkin liegen
   * außerhalb der Sprachebene. Ein Link mit Sprachpräfix zeigt dort auf
   * /en/admin — und das gibt es nicht.
   */
  staff?: boolean;
};

export function SiteHeader({
  isLoggedIn,
  isAdmin,
  isTeacher,
  showLanguageSwitcher = false,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  /** PROJ-43: Im Mitarbeiterbereich gibt es nichts umzuschalten. */
  showLanguageSwitcher?: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links: NavLink[] = [
    { href: "/kurse", label: t("courses") },
    { href: "/stundenplan", label: t("schedule") },
    { href: "/events", label: t("events") },
    ...(isTeacher ? [{ href: "/lehrer", label: t("myCourses"), staff: true }] : []),
    ...(isAdmin || isTeacher ? [{ href: "/checkin", label: t("checkin"), staff: true }] : []),
    ...(isAdmin ? [{ href: "/admin", label: t("admin"), staff: true }] : []),
    ...(isLoggedIn
      ? [
          { href: "/mein-bereich", label: t("dashboard") },
          { href: "/profil", label: t("profile") },
        ]
      : [{ href: "/login", label: t("login") }]),
  ];

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  /**
   * Ab wann die Leiste statt des Menüknopfs erscheint.
   *
   * Bisher immer ab 768 px. Für Kunden passt das — vier bis fünf Einträge
   * brauchen dort keine 700 px. Lehrer und Admins haben aber „Meine Kurse",
   * „Check-in" und „Admin" zusätzlich, und ihre Leiste misst 863 px: Die Seite
   * ließ sich zwischen 768 und rund 862 px seitlich schieben. Genau 768 px ist
   * das iPad im Hochformat — also das Gerät, auf dem eine Lehrkraft im Studio
   * die Anwesenheit abhakt.
   *
   * Statt die Abstände zu quetschen bekommen die langen Leisten mehr Anlauf:
   * Bis 1024 px führt für sie der Menüknopf, dessen Einträge ohnehin die
   * größeren Tippziele haben. Für Kunden bleibt alles, wie es war.
   *
   * Die Klassennamen stehen ausgeschrieben da, weil Tailwind sie im Quelltext
   * finden muss — zusammengesetzte Namen fehlen später im Stylesheet.
   */
  const langeLeiste = links.length > 5;
  const leisteAb = langeLeiste ? "hidden lg:flex" : "hidden md:flex";
  const knopfBis = langeLeiste ? "lg:hidden" : "md:hidden";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-heading text-lg font-bold tracking-[-0.5px]">
          Vienna Salsa Studio
        </Link>

        <nav className={cn(leisteAb, "items-center gap-1")}>
          {links.map((link) => {
            // Mitarbeiterbereiche ohne Sprachpräfix — sie haben keine
            // Sprachebene. Die Sprachwahl des Betreibers bleibt dabei
            // erhalten; kehrt er in den Kundenbereich zurück, ist sie wieder da.
            const Komponente = link.staff ? NextLink : Link;
            return (
              <Komponente
                key={link.href}
                href={link.href}
                className={cn(
                  "nav-label px-3 py-2 border-b-2 -mb-px transition-colors",
                  isActive(link.href)
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Komponente>
            );
          })}
          {showLanguageSwitcher && <LanguageSwitcher className="ml-1" />}
          {isLoggedIn && <LogoutButton />}
        </nav>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className={knopfBis} aria-label={t("openMenu")}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t("menu")}</SheetTitle>
            </SheetHeader>
            {/* gap-2 statt gap-1 und py-3 statt py-2: Die Eintraege waren 36 px
                hoch mit 4 px Abstand — gemessen, nicht geschaetzt. Apple nennt
                44 px als Mindestgroesse fuer Tippziele, und auf dem Handy wurde
                regelmaessig der Eintrag darueber getroffen. Jetzt 44 px mit
                8 px Abstand. */}
            <nav className="flex flex-col gap-2 mt-4">
              {links.map((link) => {
                const Komponente = link.staff ? NextLink : Link;
                return (
                  <Komponente
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "px-3 py-3 rounded-md text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "bg-muted text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {link.label}
                  </Komponente>
                );
              })}
              {/* PROJ-43 BUG-1: Der Umschalter stand nur in der Desktop-Leiste
                  und war unter 768 px gar nicht erreichbar — wer auf dem Handy
                  die Sprache wechseln wollte, konnte es nicht. Für eine
                  Tanzschule ist das Handy der häufigste Zugang. */}
              {showLanguageSwitcher && (
                <div className="mt-2 border-t px-3 pt-3">
                  <LanguageSwitcher />
                </div>
              )}
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
