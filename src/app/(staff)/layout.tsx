import { createClient } from "@/lib/supabase/server";
import { isTeachingUser } from "@/lib/auth/teaches-courses";
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
 *
 * Der Inhalt ist bewusst derselbe wie im Kundenbereich — dieselbe Kopf- und
 * Fußzeile, damit ein Lehrer nicht in einer fremd aussehenden App landet.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let isTeacher = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
    // PROJ-40: auch ein Admin, der tatsächlich unterrichtet.
    isTeacher = await isTeachingUser(supabase, user.id, profile?.role);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} isTeacher={isTeacher} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
