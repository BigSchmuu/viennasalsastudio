import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer";
import { zweiteStufeLage } from "@/lib/auth/zweite-stufe-lage";
import { WEG_CODE, WEG_EINRICHTEN } from "@/lib/auth/zweite-stufe";
import { SiteHeader } from "@/components/nav/site-header";
import { SiteFooter } from "@/components/nav/site-footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // PROJ-Performance: einmal pro Anfrage, nicht einmal pro Komponente.
  const { user, isAdmin, isTeacher } = await getViewerContext();

  // PROJ-58: Ein Admin ohne bestätigte zweite Stufe erreicht auch den
  // Kundenbereich nicht — so hat der Betreiber es entschieden. Folge: Wer
  // Admin wird, braucht die App ab diesem Tag auch für seine eigenen
  // Rechnungen. Für alle anderen ändert sich hier nichts, auch nicht für
  // Besucher ohne Anmeldung.
  if (isAdmin) {
    const lage = await zweiteStufeLage();
    if (lage === "einrichten") redirect(WEG_EINRICHTEN);
    if (lage === "bestaetigen") redirect(WEG_CODE);
  }

  return (
    <div className="brand-surface flex min-h-dvh flex-col">
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} isTeacher={isTeacher} showLanguageSwitcher />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
