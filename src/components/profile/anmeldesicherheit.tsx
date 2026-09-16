"use client";

import { useEffect, useState } from "react";
// Nicht der Link aus @/i18n/navigation: /sicherheit liegt neben dem
// Kundenbereich und hat keine Sprachebene — ein Präfix führte ins Leere.
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { geraetMerken } from "@/lib/actions/geraet-merken";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Anmeldesicherheit im Profil (PROJ-58) — nur für Verwaltungskonten.
 *
 * Bewusst nicht übersetzt: Der Abschnitt erscheint ausschließlich für Admins,
 * und die Verwaltung ist durchgehend deutsch. Englische Sätze für eine
 * Handvoll Studiokonten zu erfinden, hieße eine zweite Fassung zu pflegen, die
 * niemand liest.
 *
 * Den Zustand holt die Komponente selbst: Welche Faktoren am *eigenen* Konto
 * hängen, darf die Sitzung im Browser erfragen. Für fremde Konten gilt das
 * nicht — das läuft über die Verwaltung.
 */
export function Anmeldesicherheit() {
  const [eingerichtetAm, setEingerichtetAm] = useState<string | null | undefined>(undefined);
  const [meldetAb, setMeldetAb] = useState(false);

  useEffect(() => {
    let verworfen = false;

    async function laden() {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      if (verworfen) return;
      const bestaetigt = (data?.totp ?? []).find((f) => f.status === "verified");
      setEingerichtetAm(bestaetigt?.created_at ?? null);
    }

    void laden();
    return () => {
      verworfen = true;
    };
  }, []);

  async function alleAbmelden() {
    setMeldetAb(true);
    const supabase = createClient();
    // Erst den Merker löschen, dann abmelden: Nach dem Abmelden bekäme der
    // Server keine gültige Sitzung mehr zu sehen.
    await geraetMerken(false);
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/login";
  }

  if (eingerichtetAm === undefined) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {eingerichtetAm ? (
          <>
            <Badge variant="secondary">Zweite Stufe aktiv</Badge>
            <span className="text-sm text-muted-foreground">
              eingerichtet am{" "}
              {new Date(eingerichtetAm).toLocaleDateString("de-AT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                timeZone: "Europe/Vienna",
              })}
            </span>
          </>
        ) : (
          <>
            <Badge variant="destructive">Noch nicht eingerichtet</Badge>
            <Button asChild variant="link" className="h-auto p-0 text-sm">
              <Link href="/sicherheit/einrichten">Jetzt einrichten</Link>
            </Button>
          </>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Auf Geräten, denen du vertraut hast, bleibt die Anmeldung bis zu 30 Tage bestehen. Hast du ein
        Gerät verloren oder verkauft, melde hier alle ab — danach braucht jedes Gerät wieder Passwort
        und Code.
      </p>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="min-h-11" disabled={meldetAb}>
            Alle Geräte abmelden
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle Geräte abmelden?</AlertDialogTitle>
            <AlertDialogDescription>
              Das betrifft auch dieses Gerät — du meldest dich anschließend neu an. Deine
              Authenticator-App bleibt eingerichtet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={alleAbmelden}>Alle abmelden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
