import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Vienna Salsa Studio by Lisa &amp; Samuel OG</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/impressum" className="hover:text-foreground transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors">
            Datenschutz
          </Link>
          <Link href="/agb" className="hover:text-foreground transition-colors">
            AGB
          </Link>
        </nav>
      </div>
    </footer>
  );
}
