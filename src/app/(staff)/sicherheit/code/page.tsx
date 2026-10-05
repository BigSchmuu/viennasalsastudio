import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { WEITER_PARAM } from "@/lib/auth/zweite-stufe";
import { Card, CardContent } from "@/components/ui/card";
import { CodeBestaetigen } from "@/components/auth/code-bestaetigen";

export const metadata = { title: "Code bestätigen" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CodeBestaetigenPage({ searchParams }: Props) {
  const { user, isAdmin } = await getViewerContext();

  if (!user) {
    redirect("/login?redirect=/sicherheit/code");
  }
  if (!isAdmin) {
    redirect("/");
  }

  // PROJ-73: Das Ziel kommt aus der Adresse und ist damit beeinflussbar —
  // dieselbe Prüfung wie bei Login und Mail-Link lässt nur Pfade auf dieser
  // Seite durch. Ohne Ziel bleibt es beim Dashboard.
  const weiterParam = (await searchParams)[WEITER_PARAM];
  const weiterNach = safeRedirectPath(
    typeof weiterParam === "string" ? weiterParam : null,
    "/admin"
  );

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-[-0.5px]">Code bestätigen</h1>
        <p className="text-muted-foreground">
          Öffne deine Authenticator-App und gib den Code ein, der dort steht.
        </p>
      </div>
      <Card className="rounded-card shadow-soft">
        <CardContent className="pt-6">
          {/* Wer hier landet, obwohl gar kein Eintrag mehr besteht, wird von
              der Komponente zur Einrichtung geschickt — dann hat jemand gerade
              zurückgesetzt. */}
          <CodeBestaetigen weiterNach={weiterNach} />
        </CardContent>
      </Card>
    </div>
  );
}
