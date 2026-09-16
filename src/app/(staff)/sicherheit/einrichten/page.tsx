import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer";
import { Card, CardContent } from "@/components/ui/card";
import { ZweiteStufeEinrichten } from "@/components/auth/zweite-stufe-einrichten";

/**
 * Verwaltung absichern (PROJ-58).
 *
 * Liegt neben dem Kundenbereich statt darin: Die Seite ist einsprachig
 * deutsch, und unter `/en/...` stünde sonst deutscher Text. Denselben Weg
 * gehen bereits Lehreransicht und Einlass.
 */
export const metadata = { title: "Verwaltung absichern" };

export default async function VerwaltungAbsichernPage() {
  const { user, isAdmin } = await getViewerContext();

  if (!user) {
    redirect("/login?redirect=/sicherheit/einrichten");
  }
  if (!isAdmin) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {/* Eine echte Überschrift, kein gestyltes div (QA-Befund BUG-2): Auf den
          beiden Seiten, an denen niemand vorbeikommt, hätte ein Screenreader
          sonst keinen Ankerpunkt. */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-[-0.5px]">Verwaltung absichern</h1>
        <p className="text-muted-foreground">
          Die Verwaltung führt zu Bankdaten und allen Kundenprofilen. Deshalb reicht ein Passwort
          allein hier nicht — es braucht zusätzlich einen Code aus einer App auf deinem Handy.
        </p>
      </div>
      <Card className="rounded-card shadow-soft">
        <CardContent className="pt-6">
          <ZweiteStufeEinrichten weiterNach="/admin" />
        </CardContent>
      </Card>
    </div>
  );
}
