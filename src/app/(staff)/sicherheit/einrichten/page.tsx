import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="rounded-card shadow-soft">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-[-0.5px]">Verwaltung absichern</CardTitle>
          <CardDescription>
            Die Verwaltung führt zu Bankdaten und allen Kundenprofilen. Deshalb reicht ein Passwort
            allein hier nicht — es braucht zusätzlich einen Code aus einer App auf deinem Handy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZweiteStufeEinrichten weiterNach="/admin" />
        </CardContent>
      </Card>
    </div>
  );
}
