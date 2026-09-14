import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Einmal-Links aus den Supabase-Mails: Bestätigung, Passwort, Einladung.
 *
 * Seit 2026-09-14 löst ein solcher Link sein Token nicht mehr beim Öffnen ein,
 * sondern erst, wenn der Kunde auf einen Knopf tippt. Das Supabase-Log vom
 * 2026-09-13 hatte gezeigt, warum: Jeder Link wurde einmal erfolgreich
 * eingelöst und in derselben Sekunde noch ein-, zweimal aufgerufen — von einer
 * Mail-App oder einem Scanner, der Links vorab prüft, oder beim Weiterreichen
 * vom Browser der Mail-App an Safari. Der Kunde landete danach auf „ungültig
 * oder abgelaufen“, obwohl mit dem Link alles stimmte.
 *
 * Ein Aufruf verbraucht jetzt nichts mehr. Das tut nur das Absenden des
 * Formulars — und das tut kein Scanner.
 */

const LINK_TYPEN = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const satisfies readonly EmailOtpType[];

export type LinkTyp = (typeof LINK_TYPEN)[number];

/** Nur die Typen, die Supabase kennt — alles andere ist ein kaputter Link. */
export function linkTyp(wert: string | null | undefined): LinkTyp | null {
  return LINK_TYPEN.find((typ) => typ === wert) ?? null;
}

/** Was der Knopf dem Kunden verspricht. */
export type LinkZweck = "bestaetigen" | "passwort" | "einladung" | "anmelden";

export function linkZweck(typ: LinkTyp): LinkZweck {
  switch (typ) {
    case "recovery":
      return "passwort";
    case "invite":
      return "einladung";
    case "magiclink":
      return "anmelden";
    default:
      return "bestaetigen";
  }
}
