"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  studentenpreisAuskunft,
  type StudentenpreisAuskunft,
} from "@/lib/actions/studentenpreis";

/**
 * PROJ-101: Das Kästchen „Ich bin Student(in)“ — oder der Grund, warum es
 * fehlt.
 *
 * Ein graues, gesperrtes Kästchen wäre die naheliegende Lösung und die
 * schlechtere: Es erzeugt die Frage „warum geht das nicht?“, und die landet
 * beim Betreiber. Hier steht an derselben Stelle ein Satz, und wo etwas zu tun
 * ist (Geburtsdatum fehlt, nicht angemeldet), steht der Weg dahin daneben.
 *
 * Das Bauteil fragt selbst nach seinem Fall, statt sich die Auskunft durch
 * mehrere Ebenen übergeben zu lassen: Der Buchungsdialog wird an vier Stellen
 * gerendert, der Ticketdialog an einer weiteren. Die Antwort hängt ohnehin nur
 * am angemeldeten Konto und nicht am Kurs.
 *
 * Entschieden wird hier nichts. Welcher Preis entsteht, bestimmt die Datenbank
 * (`studentenpreis_erlaubt`) — ein Kästchen kann man abschalten, eine Anfrage
 * nicht.
 */
export function StudentenpreisWahl({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (wert: boolean) => void;
}) {
  const t = useTranslations("booking");
  const [auskunft, setAuskunft] = useState<StudentenpreisAuskunft | null>(null);

  useEffect(() => {
    let verworfen = false;
    studentenpreisAuskunft().then((antwort) => {
      if (!verworfen) setAuskunft(antwort);
    });
    return () => {
      verworfen = true;
    };
  }, []);

  // Ein Häkchen aus einem früheren Dialog darf nicht stehen bleiben, wenn die
  // Auskunft nein sagt — sonst ginge das Kennzeichen mit, obwohl nichts
  // angezeigt wurde. Die Datenbank würde es verwerfen; der Kunde hätte
  // trotzdem einen Preis gesehen, den er nicht bekommt.
  useEffect(() => {
    if (auskunft && !auskunft.moeglich && checked) onChange(false);
  }, [auskunft, checked, onChange]);

  // Solange die Auskunft läuft, steht hier nichts: Ein Kästchen, das gleich
  // wieder verschwindet, ist schlimmer als eines, das kurz fehlt.
  if (auskunft === null) return null;

  if (auskunft.moeglich) {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(wert) => onChange(wert === true)}
        />
        <Label htmlFor={id} className="font-normal">
          {t("studentPrice")}
        </Label>
      </div>
    );
  }

  const text =
    auskunft.grund === "zu_alt"
      ? t("studentPriceTooOld")
      : auskunft.grund === "kein_geburtsdatum"
        ? t("studentPriceNoBirthdate")
        : auskunft.grund === "nicht_angemeldet"
          ? t("studentPriceSignedOut")
          : t("studentPriceUnknown");

  const weg =
    auskunft.grund === "kein_geburtsdatum"
      ? { href: "/profil", text: t("studentPriceToProfile") }
      : auskunft.grund === "nicht_angemeldet"
        ? { href: "/login", text: t("studentPriceToLogin") }
        : null;

  return (
    <p className="text-sm text-muted-foreground" id={id}>
      {text}
      {weg && (
        <>
          {" "}
          <Link href={weg.href} className="underline hover:no-underline">
            {weg.text}
          </Link>
        </>
      )}
    </p>
  );
}
