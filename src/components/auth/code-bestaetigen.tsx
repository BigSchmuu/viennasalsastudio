"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { geraetMerken } from "@/lib/actions/geraet-merken";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CodeEingabe } from "@/components/auth/code-eingabe";
import {
  codeFehlertext,
  codeVollstaendig,
  nurZiffern,
  uhrzeitHinweisZeigen,
  WEG_EINRICHTEN,
} from "@/lib/auth/zweite-stufe";

/**
 * Der zweite Schritt beim Anmelden (PROJ-58).
 *
 * Das Häkchen ist leer vorausgewählt. Das ist keine Nachlässigkeit, sondern der
 * Kern der Sache: Am Rechner im Studio oder bei jemand anderem soll nichts
 * gemerkt werden, ohne dass es jemand ausdrücklich entscheidet.
 */
export function CodeBestaetigen({ weiterNach }: { weiterNach: string }) {
  const [code, setCode] = useState("");
  const [merken, setMerken] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fehlversuche, setFehlversuche] = useState(0);
  const [prueft, setPrueft] = useState(false);
  const [bereit, setBereit] = useState(false);
  const faktorId = useRef<string | null>(null);

  useEffect(() => {
    let verworfen = false;

    async function faktorSuchen() {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      if (verworfen) return;

      const bestaetigt = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!bestaetigt) {
        // Kein bestätigter Eintrag mehr — typischerweise hat ihn gerade jemand
        // zurückgesetzt. Dann gehört der Weg zur Einrichtung, nicht zum Ziel
        // nach bestandener Prüfung.
        window.location.href = WEG_EINRICHTEN;
        return;
      }

      faktorId.current = bestaetigt.id;
      setBereit(true);
    }

    void faktorSuchen();
    return () => {
      verworfen = true;
    };
  }, []);

  async function bestaetigen(e: React.FormEvent) {
    e.preventDefault();
    if (!faktorId.current || !codeVollstaendig(code)) return;

    setPrueft(true);
    setFehler(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: faktorId.current,
        code: nurZiffern(code),
      });

      if (error) {
        setFehler(codeFehlertext(error));
        setFehlversuche((n) => n + 1);
        setCode("");
        return;
      }

      // Erst nach bestandener Prüfung merken — vorher wüsste der Merker nicht,
      // wessen Gerät er sich merkt.
      await geraetMerken(merken);
      window.location.href = weiterNach;
    } finally {
      setPrueft(false);
    }
  }

  async function abmelden() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <form onSubmit={bestaetigen} className="space-y-4" noValidate>
      {fehler ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-1">
            <p>{fehler}</p>
            {uhrzeitHinweisZeigen(fehlversuche) ? (
              <p>
                Klappt es weiterhin nicht? Prüfe die Uhrzeit deines Handys — geht sie falsch, wird
                jeder Code abgelehnt.
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <CodeEingabe wert={code} aufAenderung={setCode} deaktiviert={prueft || !bereit} />

      <div className="flex items-start gap-3">
        <Checkbox
          id="geraet-merken"
          checked={merken}
          onCheckedChange={(wert) => setMerken(wert === true)}
          disabled={prueft}
          className="mt-0.5"
        />
        <Label htmlFor="geraet-merken" className="text-sm font-normal leading-snug">
          Diesem Gerät 30 Tage vertrauen
          <span className="block text-muted-foreground">
            Nur am eigenen Gerät setzen — nicht am Studio-Rechner und nicht bei anderen.
          </span>
        </Label>
      </div>

      <Button type="submit" className="min-h-11 w-full" disabled={prueft || !codeVollstaendig(code) || !bereit}>
        {prueft ? "Wird geprüft …" : "Weiter"}
      </Button>

      <Button type="button" variant="link" className="h-auto w-full p-0 text-sm" onClick={abmelden}>
        Abmelden
      </Button>
    </form>
  );
}
