"use client";

import { useState } from "react";
import { zweiteStufeZuruecksetzen } from "@/lib/actions/admin/zweite-stufe";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
 * Zweite Stufe eines anderen Verwaltungskontos (PROJ-58).
 *
 * Der Weg zurück, wenn jemand sein Handy verloren hat — ohne dass jemand die
 * Datenbank anfassen muss.
 */
export function ZweiteStufeVerwaltung({
  kontoId,
  eingerichtet,
  eigenesKonto,
}: {
  kontoId: string;
  eingerichtet: boolean;
  eigenesKonto: boolean;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erledigt, setErledigt] = useState(false);

  async function zuruecksetzen() {
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await zweiteStufeZuruecksetzen(kontoId);
    setLaeuft(false);
    if ("error" in ergebnis) {
      setFehler(ergebnis.error);
      return;
    }
    setErledigt(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {eingerichtet && !erledigt ? (
          <Badge variant="secondary">Zweite Stufe aktiv</Badge>
        ) : (
          <Badge variant="outline">Nicht eingerichtet</Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {eingerichtet && !erledigt
            ? "Für die Anmeldung wird zusätzlich ein Code aus der Authenticator-App verlangt."
            : "Beim nächsten Anmelden wird zur Einrichtung geführt."}
        </span>
      </div>

      {fehler ? (
        <Alert variant="destructive">
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      ) : null}

      {erledigt ? (
        <Alert>
          <AlertDescription>
            Zurückgesetzt. Das Konto wurde abgemeldet, richtet die App beim nächsten Anmelden neu ein
            und hat eine E-Mail darüber bekommen.
          </AlertDescription>
        </Alert>
      ) : null}

      {eigenesKonto ? (
        <p className="text-sm text-muted-foreground">
          Die eigene zweite Stufe lässt sich hier nicht zurücksetzen — sonst wäre die Pflicht mit einem
          Klick abgeschaltet. Im Notfall setzt ein anderes Verwaltungskonto zurück.
        </p>
      ) : eingerichtet && !erledigt ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="min-h-11" disabled={laeuft}>
              {laeuft ? "Wird zurückgesetzt …" : "Zweite Stufe zurücksetzen"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zweite Stufe zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Das Konto wird von allen Geräten abgemeldet und richtet die Authenticator-App beim
                nächsten Anmelden neu ein. Das Passwort bleibt unverändert — Zurücksetzen allein öffnet
                also nichts. Der Betroffene bekommt eine E-Mail darüber.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={zuruecksetzen}>Zurücksetzen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
