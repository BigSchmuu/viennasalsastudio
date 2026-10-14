"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";
import { createServiceClient } from "@/lib/supabase/service";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { betragAusEingabe, nameGueltig, offlineAdresse } from "@/lib/kunden/offline";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Einen Barzahler von Hand eintragen (PROJ-82).
 *
 * Es entsteht ein **echter** Kunde — mit Profil, Kursplatz und Preis. Der
 * Betreiber wollte, dass diese Leute wie jeder andere Teilnehmer zählen:
 * Anwesenheit, Kursgrenze, Auswertung. Eine zweite Art von Teilnehmer daneben
 * wäre in jeder dieser Listen eine Lücke, die man ihr nicht ansieht.
 *
 * Das Konto bekommt eine Platzhalter-Adresse auf `.invalid` (siehe
 * lib/kunden/offline.ts): Anmelden kann sich damit niemand, und der Versand
 * überspringt sie, statt an jeder Erinnerung zu scheitern.
 *
 * Geschrieben wird mit dem Dienstschlüssel — eine Lehrkraft darf weder Konten
 * anlegen noch Abos schreiben. Die Rechteprüfung steht deshalb **hier** und
 * muss dicht sein: Lehrkraft genau dieses Kurses, oder Verwaltung.
 */
export async function legeBarzahlerAn(
  courseId: string,
  name: string,
  betragEingabe: string
): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await requireAdminOrTeacher();

  if (!nameGueltig(name)) {
    return { error: "Bitte einen Namen mit mindestens zwei Zeichen angeben." };
  }
  const betrag = betragAusEingabe(betragEingabe);
  if (betrag === null) {
    return { error: "Bitte einen Betrag angeben, zum Beispiel 50 oder 49,50." };
  }

  // Eine Lehrkraft nur für ihre eigenen Kurse. Gelesen mit ihrem eigenen
  // Zugang: Was sie dort nicht sieht, unterrichtet sie nicht.
  if (!isAdmin) {
    const { data: zuordnung } = await supabase
      .from("course_teachers")
      .select("course_id")
      .eq("course_id", courseId)
      .eq("teacher_id", user.id)
      .maybeSingle();
    if (!zuordnung) {
      return { error: "Dieser Kurs gehört nicht zu deinen Kursen." };
    }
  }

  const service = createServiceClient();

  // Die Kursgrenze gilt auch hier. Der Platz wird belegt, sobald das Abo steht
  // — und ein stillschweigend überbuchter Kurs bringt die Rollenbalance und die
  // Belegungsanzeige durcheinander, ohne dass jemand sieht, woher.
  const { data: kurs } = await service
    .from("courses")
    .select("name, max_participants")
    .eq("id", courseId)
    .maybeSingle();
  if (!kurs) return { error: "Der Kurs wurde nicht gefunden." };

  if (kurs.max_participants !== null) {
    const { count } = await service
      .from("course_members")
      .select("customer_id", { count: "exact", head: true })
      .eq("course_id", courseId);
    if ((count ?? 0) >= kurs.max_participants) {
      return {
        error: `Der Kurs ist voll (${count} von ${kurs.max_participants}). Bitte in der Verwaltung klären.`,
      };
    }
  }

  const { data: konto, error: kontoFehler } = await service.auth.admin.createUser({
    email: offlineAdresse(crypto.randomUUID()),
    // Bestätigt, damit das Konto vollständig ist — ein Passwort gibt es nicht,
    // und an die Adresse kommt keine Einladung. Hinein kommt also niemand.
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) {
    console.error("Barzahler: Konto nicht angelegt", kontoFehler);
    return { error: "Der Kunde konnte nicht angelegt werden." };
  }

  const kundeId = konto.user.id;
  const { error: profilFehler } = await service
    .from("profiles")
    .update({ full_name: name.trim() })
    .eq("id", kundeId);
  if (profilFehler) {
    // Das Konto steht schon — ohne Namen wäre es eine Zeile, die niemand
    // zuordnet. Also zurückräumen, statt eine Hälfte stehen zu lassen.
    await service.auth.admin.deleteUser(kundeId).catch(() => {});
    console.error("Barzahler: Name nicht gespeichert", profilFehler);
    return { error: "Der Kunde konnte nicht angelegt werden." };
  }

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: courseId,
      status: "active",
      name: "Barzahler",
      price: betrag,
      cycle_anchor_date: heuteInWien(),
    })
    .select("id")
    .single();
  if (aboFehler || !abo) {
    await service.auth.admin.deleteUser(kundeId).catch(() => {});
    console.error("Barzahler: Abo nicht angelegt", aboFehler);
    return { error: "Der Kursplatz konnte nicht angelegt werden." };
  }

  // PROJ-84: Und auf die Liste. Ohne diesen Eintrag wäre der Gast angelegt,
  // stünde aber nirgends — die Lehrkraft hat ihn ja gerade eingetragen, um
  // Geld von ihm einzusammeln.
  //
  // Über den Dienstschlüssel, wie alles davor in dieser Funktion: Die Tabelle
  // hat bewusst keine Schreibregel.
  const { error: eintragFehler } = await service.from("cash_entries").insert({
    customer_id: kundeId,
    subscription_id: abo.id,
    amount_due: betrag,
    created_by: user.id,
  });
  if (eintragFehler) {
    await service.auth.admin.deleteUser(kundeId).catch(() => {});
    console.error("Barzahler: Eintrag nicht angelegt", eintragFehler);
    return { error: "Der Barzahler-Eintrag konnte nicht angelegt werden." };
  }

  revalidatePath(`/lehrer/${courseId}`);
  revalidatePath("/admin/barzahlungen");
  revalidatePath("/admin/kunden");
  return { success: true };
}
