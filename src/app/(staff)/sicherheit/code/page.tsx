import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBestaetigen } from "@/components/auth/code-bestaetigen";

export const metadata = { title: "Code bestätigen" };

export default async function CodeBestaetigenPage() {
  const { user, isAdmin } = await getViewerContext();

  if (!user) {
    redirect("/login?redirect=/sicherheit/code");
  }
  if (!isAdmin) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card className="rounded-card shadow-soft">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-[-0.5px]">Code bestätigen</CardTitle>
          <CardDescription>Öffne deine Authenticator-App und gib den Code ein, der dort steht.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Wer hier landet, obwohl gar kein Eintrag mehr besteht, wird von
              der Komponente zur Einrichtung geschickt — dann hat jemand gerade
              zurückgesetzt. */}
          <CodeBestaetigen weiterNach="/admin" />
        </CardContent>
      </Card>
    </div>
  );
}
