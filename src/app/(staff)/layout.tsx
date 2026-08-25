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
    <div className="flex min-h-screen flex-col">
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} isTeacher={isTeacher} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
