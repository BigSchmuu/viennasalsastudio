import { getViewerContext } from "@/lib/auth/viewer";
import { SiteHeader } from "@/components/nav/site-header";
import { SiteFooter } from "@/components/nav/site-footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // PROJ-Performance: einmal pro Anfrage, nicht einmal pro Komponente.
  const { user, isAdmin, isTeacher } = await getViewerContext();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isLoggedIn={!!user} isAdmin={isAdmin} isTeacher={isTeacher} showLanguageSwitcher />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
