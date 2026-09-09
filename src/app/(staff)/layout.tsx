import { getViewerContext } from "@/lib/auth/viewer";
import { SiteHeader } from "@/components/nav/site-header";
import { SiteFooter } from "@/components/nav/site-footer";

/**
 * Rahmen für die Mitarbeiterbereiche (PROJ-43).
 *
 * Lehreransicht und Einlass lagen bisher im Kundenbereich. Seit dieser den
 * Sprachpräfix trägt, wären sie als `/en/lehrer` erreichbar und würden dort
 * deutschen Text zeigen — deshalb stehen sie jetzt daneben. Für den Benutzer
 * ändert sich nichts: Klammern im Ordnernamen erzeugen keinen Adressteil, die
 * Seiten liegen weiterhin unter `/lehrer` und `/checkin`.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isTeacher } = await getViewerContext();

  return (
    // min-h-dvh statt min-h-screen: `100vh` rechnet iOS Safari *ohne* seine
    // Adressleiste. Auf einer inhaltsarmen Seite wird das Dokument dadurch um
    // genau deren Hoehe zu hoch, die Seite wird scrollbar, obwohl es nichts zu
    // scrollen gibt — und Safari blendet die Leiste beim kleinsten Wischen ein
    // und aus. Der Inhalt springt dann um rund 50 Pixel, also fast genau eine
    // Menuezeile. Gemeldet am 2026-09-09: „dann erscheint oben eine Adresszeile
    // die sonst nicht erscheint, danach sind die Menuepunkte verschoben."
    <div className="flex min-h-dvh flex-col">
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} isTeacher={isTeacher} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
