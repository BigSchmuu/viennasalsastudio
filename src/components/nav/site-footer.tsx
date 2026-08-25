import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/impressum" className="hover:text-foreground transition-colors">
            {t("imprint")}
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors">
            {t("privacy")}
          </Link>
          <Link href="/agb" className="hover:text-foreground transition-colors">
            {t("terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
