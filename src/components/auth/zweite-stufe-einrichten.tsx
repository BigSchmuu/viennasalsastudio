"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeEingabe } from "@/components/auth/code-eingabe";
import {
  codeFehlertext,
  codeVollstaendig,
  nurZiffern,
  schluesselLesbar,
  uhrzeitHinweisZeigen,
} from "@/lib/auth/zweite-stufe";

/**
 * Die Einrichtung der zweiten Stufe (PROJ-58).
 *
 * Der Schlüssel wird hier erzeugt und ist genau so lange sichtbar, wie diese
 * Seite offen ist — gespeichert wird er bei Supabase, nicht bei uns.
 *
 * Der QR-Code wird aus der Adresse erzeugt, die Supabase mitliefert, statt das
 * fertige Bild von dort einzublenden: Supabase schickt es als SVG-Text, und
 * fremdes Markup ungeprüft in die Seite zu schreiben ist eine Gewohnheit, die
 * man sich nicht angewöhnen sollte. Das Paket dafür liegt ohnehin im Projekt
 * (die Tickets tragen QR-Codes).
 */
export function ZweiteStufeEinrichten({ weiterNach }: { weiterNach: string }) {
  const [qrBild, setQrBild] = useState<string | null>(null);
  const [schluessel, setSchluessel] = useState<string | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [fehlversuche, setFehlversuche] = useState(0);
  const [speichert, setSpeichert] = useState(false);
  const faktorId = useRef<string | null>(null);

  useEffect(() => {
    let verworfen = false;

    async function vorbereiten() {
      const supabase = createClient();

      // Ein früher abgebrochener Versuch hinterlässt einen unbestätigten
      // Eintrag. Der blockiert den Namen, und der nächste Anlauf scheiterte
      // dann an etwas, das mit dem eigentlichen Vorgang nichts zu tun hat.
      const { data: vorhandene } = await supabase.auth.mfa.listFactors();
      for (const faktor of vorhandene?.all ?? []) {
        if (faktor.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: faktor.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Verwaltung",
      });

      if (verworfen) return;

      if (error || !data) {
        setLadefehler(
          "Die Einrichtung lässt sich gerade nicht starten. Lade die Seite neu — bleibt es dabei, melde dich beim Studio."
        );
        return;
      }

      faktorId.current = data.id;
      setSchluessel(data.totp.secret);
      const bild = await QRCode.toDataURL(data.totp.uri, { width: 260, margin: 1 });
      if (!verworfen) setQrBild(bild);
    }

    void vorbereiten();
    return () => {
      verworfen = true;
    };
  }, []);

  async function bestaetigen(e: React.FormEvent) {
    e.preventDefault();
    if (!faktorId.current || !codeVollstaendig(code)) return;

    setSpeichert(true);
    setFehler(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: faktorId.current,
        code: nurZiffern(code),
      });

      if (error) {
        // Der Eintrag bleibt unbestätigt, also bleibt derselbe QR-Code gültig
        // — wer sich vertippt, muss nicht neu scannen.
        setFehler(codeFehlertext(error));
        setFehlversuche((n) => n + 1);
        setCode("");
        return;
      }

      window.location.href = weiterNach;
    } finally {
      setSpeichert(false);
    }
  }

  if (ladefehler) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{ladefehler}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-5">
        <li className="space-y-2">
          <p className="font-heading font-semibold">1. App öffnen</p>
          <p className="text-sm text-muted-foreground">
            Installiere eine Authenticator-App, falls du noch keine hast — etwa Google Authenticator,
            Microsoft Authenticator oder den Passwortmanager, den du ohnehin benutzt.
          </p>
        </li>

        <li className="space-y-3">
          <p className="font-heading font-semibold">2. Diesen Code scannen</p>
          <div className="flex justify-center rounded-card border border-border/60 bg-white p-4">
            {qrBild ? (
              <Image src={qrBild} alt="QR-Code für die Authenticator-App" width={260} height={260} unoptimized />
            ) : (
              <Skeleton className="h-[260px] w-[260px]" />
            )}
          </div>
          {schluessel ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Die Kamera spielt nicht mit? Schlüssel zum Abtippen
              </summary>
              <p className="mt-2 select-all break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
                {schluesselLesbar(schluessel)}
              </p>
            </details>
          ) : null}
        </li>

        <li className="space-y-3">
          <p className="font-heading font-semibold">3. Code aus der App eingeben</p>
          <form onSubmit={bestaetigen} className="space-y-3" noValidate>
            {fehler ? (
              <Alert variant="destructive">
                <AlertDescription className="space-y-1">
                  <p>{fehler}</p>
                  {uhrzeitHinweisZeigen(fehlversuche) ? (
                    <p>
                      Wenn es weiter nicht klappt: Stimmt die Uhrzeit deines Handys? Eine falsch gehende
                      Uhr verwirft jeden Code.
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <CodeEingabe wert={code} aufAenderung={setCode} deaktiviert={speichert || !qrBild} />

            <Button
              type="submit"
              className="min-h-11 w-full"
              disabled={speichert || !codeVollstaendig(code) || !qrBild}
            >
              {speichert ? "Wird geprüft …" : "Einrichtung abschließen"}
            </Button>
          </form>
        </li>
      </ol>
    </div>
  );
}
