"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";
import { betragAusEingabe } from "@/lib/kunden/offline";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Die Barzahler-Liste führen (PROJ-84).
 *
 * Alle fünf Vorgänge laufen über `security definer`-Funktionen: Für eine
 * Lehrkraft sind `subscriptions` und `sepa_mandates` gesperrt, und die Prüfung
 * „darf diese Person an diesem Abo etwas tun" ist in einer Regel nicht zu
 * haben. Sie unterscheidet zwei Fälle — bei einem Kursabo die Lehrkraft dieses
 * Kurses, bei einer Flatrate jede Lehrkraft, weil ein Flatrater in jedem Kurs
 * auftauchen kann.
 *
 * Die Grenzen für den Betrag stehen hier **und** in der Datenbank: Eine
 * Oberfläche ist keine Zusicherung.
 */

function aktualisiere(courseId: string) {
  if (courseId) revalidatePath(`/lehrer/${courseId}`);
  revalidatePath("/admin/barzahlungen");
}

export type EintragAngelegt = { error: string } | { success: true; eintragId: string };

/** Einen Kunden auf die Liste setzen — Abo gewählt, Betrag von Hand. */
export async function legeEintragAn(
  subscriptionId: string,
  betragEingabe: string,
  courseId: string,
  notiz?: string
): Promise<EintragAngelegt> {
  await requireAdminOrTeacher();

  const betrag = betragAusEingabe(betragEingabe);
  if (betrag === null) {
    return { error: "Bitte einen Betrag zwischen 0,01 und 10.000 € eingeben." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_cash_entry", {
    p_subscription_id: subscriptionId,
    p_amount: betrag,
    p_note: notiz ?? null,
  });

  if (error) {
    if (error.message.includes("entry already exists")) {
      return { error: "Für dieses Abo steht schon ein Eintrag auf der Liste." };
    }
    if (error.message.includes("not authorized")) {
      return { error: "Für dieses Abo darfst du keinen Eintrag anlegen." };
    }
    if (error.message.includes("note too long")) {
      return { error: "Die Notiz ist zu lang — höchstens 300 Zeichen." };
    }
    console.error("Barzahler-Eintrag nicht angelegt", subscriptionId, error);
    return { error: "Der Eintrag konnte nicht angelegt werden." };
  }

  aktualisiere(courseId);
  return { success: true, eintragId: data.id };
}

/** Den Betrag eines Eintrags ändern — etwa um einen Rest aufzuschlagen. */
export async function aendereEintrag(
  entryId: string,
  betragEingabe: string,
  courseId: string
): Promise<ActionResult> {
  await requireAdminOrTeacher();

  const betrag = betragAusEingabe(betragEingabe);
  if (betrag === null) {
    return { error: "Bitte einen Betrag zwischen 0,01 und 10.000 € eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_cash_entry", {
    p_entry_id: entryId,
    p_amount: betrag,
  });

  if (error) {
    if (error.message.includes("below payments")) {
      return { error: "Der Betrag kann nicht unter dem liegen, was schon bezahlt ist." };
    }
    console.error("Barzahler-Eintrag nicht geändert", entryId, error);
    return { error: "Der Betrag konnte nicht geändert werden." };
  }

  aktualisiere(courseId);
  return { success: true };
}

/**
 * Die Notiz eines Eintrags setzen oder löschen (PROJ-86).
 *
 * Seit der Betrag von Hand gesetzt wird, ist der Grund dafür nirgends mehr
 * ablesbar — die Notiz hält ihn fest. Leerer Text löscht sie; das übernimmt
 * die Datenbank, damit es nicht zwei Arten von „keine Notiz“ gibt.
 */
export async function setzeNotiz(
  entryId: string,
  notiz: string,
  courseId: string
): Promise<ActionResult> {
  await requireAdminOrTeacher();

  if (notiz.length > 300) {
    return { error: "Die Notiz ist zu lang — höchstens 300 Zeichen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_cash_entry_note", {
    p_entry_id: entryId,
    p_note: notiz,
  });

  if (error) {
    if (error.message.includes("note too long")) {
      return { error: "Die Notiz ist zu lang — höchstens 300 Zeichen." };
    }
    console.error("Notiz nicht gesetzt", entryId, error);
    return { error: "Die Notiz konnte nicht gespeichert werden." };
  }

  aktualisiere(courseId);
  return { success: true };
}

/** Einen Eintrag von der Liste nehmen. Die Zahlungen dazu bleiben. */
export async function entferneEintrag(entryId: string, courseId: string): Promise<ActionResult> {
  await requireAdminOrTeacher();
  const supabase = await createClient();

  const { error } = await supabase.rpc("remove_cash_entry", { p_entry_id: entryId });

  if (error) {
    console.error("Barzahler-Eintrag nicht entfernt", entryId, error);
    return { error: "Der Eintrag konnte nicht entfernt werden." };
  }

  aktualisiere(courseId);
  return { success: true };
}

export type ZyklusAbgeschlossen = { error: string } | { success: true; entfernt: number };

/**
 * Die ganze Liste leeren — der neue Zahlungszyklus beginnt.
 *
 * Nur die Verwaltung: Eine Lehrkraft, die ihren eigenen Eintrag entfernen darf,
 * soll nicht versehentlich die Liste aller Kurse leeren.
 */
export async function schliesseZyklusAb(): Promise<ZyklusAbgeschlossen> {
  await requireAdminOrTeacher();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("close_cash_cycle");

  if (error) {
    if (error.message.includes("not authorized")) {
      return { error: "Nur die Verwaltung kann den Zyklus abschließen." };
    }
    console.error("Zyklus nicht abgeschlossen", error);
    return { error: "Der Zyklus konnte nicht abgeschlossen werden." };
  }

  revalidatePath("/admin/barzahlungen");
  return { success: true, entfernt: Number(data ?? 0) };
}

export type BarzahlungErfasst =
  | { error: string }
  // Der verbuchte Betrag kommt mit zurück: Ohne Eingabe hat ihn die Datenbank
  // aus dem offenen Rest bestimmt, und die Liste soll ihn anzeigen, ohne ihn
  // zu erraten.
  | { success: true; zahlungId: string; betrag: number };

/** Eine Zahlung erfassen — ohne Betrag den gesamten offenen Rest. */
export async function erfasseBarzahlung(
  entryId: string,
  courseId: string,
  betragEingabe?: string
): Promise<BarzahlungErfasst> {
  await requireAdminOrTeacher();

  let betrag: number | null = null;
  if (betragEingabe !== undefined && betragEingabe.trim() !== "") {
    betrag = betragAusEingabe(betragEingabe);
    if (betrag === null) {
      return { error: "Bitte einen Betrag zwischen 0,01 und 10.000 € eingeben." };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_cash_payment", {
    p_entry_id: entryId,
    p_amount: betrag,
  });

  if (error) {
    // Die Fälle, die am Kursabend vorkommen, bekommen einen eigenen Satz —
    // „Fehler beim Speichern" hilft niemandem, der Geld in der Hand hält.
    if (error.message.includes("amount above open")) {
      return { error: "Mehr als offen ist. Bitte höchstens den offenen Betrag erfassen." };
    }
    if (error.message.includes("nothing open")) {
      return { error: "Für diesen Eintrag ist nichts offen." };
    }
    if (error.message.includes("entry not found")) {
      return { error: "Dieser Eintrag steht nicht mehr auf der Liste." };
    }
    if (error.message.includes("just recorded")) {
      return { error: "Diese Zahlung ist gerade schon erfasst worden." };
    }
    console.error("Barzahlung nicht erfasst", entryId, error);
    return { error: "Die Barzahlung konnte nicht erfasst werden." };
  }

  aktualisiere(courseId);
  return { success: true, zahlungId: data.id, betrag: Number(data.amount) };
}

/**
 * Eine Zahlung zurücknehmen.
 *
 * Ohne Tagesgrenze: Der Betreiber hat entschieden, dass Lehrkraft und
 * Verwaltung dasselbe dürfen (anders als in PROJ-81).
 */
export async function nimmBarzahlungZurueck(
  paymentId: string,
  courseId: string
): Promise<ActionResult> {
  await requireAdminOrTeacher();
  const supabase = await createClient();

  const { error } = await supabase.rpc("undo_cash_payment", { p_payment_id: paymentId });

  if (error) {
    console.error("Barzahlung nicht zurückgenommen", paymentId, error);
    return { error: "Die Barzahlung konnte nicht zurückgenommen werden." };
  }

  aktualisiere(courseId);
  return { success: true };
}
