import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/analytics/period";
import { PeriodFilter } from "@/components/admin/analytics/period-filter";
import { KuendigungsListe } from "@/components/admin/kuendigungen/kuendigungs-liste";
import { teileKuendigungen, type Kuendigung } from "@/lib/admin/kuendigungen";

/**
 * Überblick der Kündigungen (PROJ-79).
 *
 * Bis hierher war eine Kündigung an drei Stellen zu sehen: als Zahl auf dem
 * Dashboard, als Balken im Verlauf und am einzelnen Kunden. Wer wissen wollte,
 * *wer* gekündigt hat, musste Kundenprofile durchgehen.
 *
 * Zwei Listen, weil zwei Dinge gemeint sind: Eine angekündigte Kündigung läuft
 * noch und lässt sich noch abwenden; eine beendete ist Geschichte und
 * interessiert als Zahl und als Muster.
 */
const AUSWAHL =
  "id, customer_id, name, cycle_anchor_date, cancelled_at, pending_effective_date, cancellation_reason, cancellation_note, courses(name), profiles(full_name)";

export default async function KuendigungenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, isCustom } = resolvePeriod(params);
  const supabase = await createClient();

  const [offeneRes, beendeteRes] = await Promise.all([
    // Angekündigt: Der Stichtag steht, vollzogen wird er vom Versandlauf
    // (lib/subscriptions/faellige-aenderungen.ts). Ohne Zeitraumgrenze — eine
    // Kündigung, die in drei Monaten wirkt, gehört in diese Liste, egal welcher
    // Zeitraum oben eingestellt ist.
    supabase.from("subscriptions").select(AUSWAHL).eq("pending_status", "cancelled"),
    supabase
      .from("subscriptions")
      .select(AUSWAHL)
      .eq("status", "cancelled")
      .not("cancelled_at", "is", null)
      .gte("cancelled_at", period.from)
      .lte("cancelled_at", period.to),
  ]);

  // Ein Lesefehler darf nicht als „keine Kündigungen" durchgehen — dieselbe
  // Lehre wie bei „Nicht zugestellt" (PROJ-16) und der Lehrerseite (PROJ-50).
  if (offeneRes.error || beendeteRes.error) {
    console.error("Kündigungen nicht lesbar", offeneRes.error ?? beendeteRes.error);
    throw new Error("Die Kündigungen konnten nicht geladen werden");
  }

  type Zeile = NonNullable<typeof offeneRes.data>[number];

  const alsKuendigung = (s: Zeile, angekuendigt: boolean): Kuendigung => ({
    aboId: s.id,
    kundeId: s.customer_id,
    kundeName: s.profiles?.full_name || "Unbenannter Kunde",
    // Der Kursname, wenn das Abo an einem Kurs hängt; sonst der Name des Abos,
    // und notfalls das Wort „Flatrate".
    aboName: s.courses?.name ?? s.name ?? "Flatrate",
    beginn: s.cycle_anchor_date,
    wirksamAb: angekuendigt ? s.pending_effective_date : s.cancelled_at,
    angekuendigt,
    grund: s.cancellation_reason,
    notiz: s.cancellation_note,
  });

  const { angekuendigt, beendet } = teileKuendigungen([
    ...(offeneRes.data ?? []).map((s) => alsKuendigung(s, true)),
    ...(beendeteRes.data ?? []).map((s) => alsKuendigung(s, false)),
  ]);

  const spanne = (wert: string) => new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT");
  const zeitraumText = `Im Zeitraum ${spanne(period.from)} bis ${spanne(period.to)} beendet.`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Kündigungen</h2>
        <p className="text-sm text-muted-foreground">
          Wer gekündigt hat, wann es wirkt und wie lange das Abo gelaufen ist
        </p>
      </div>

      {/* Der Zeitraum wirkt nur auf die beendeten — das sagt der Hinweis an der
          Liste selbst, damit niemand die angekündigten für gefiltert hält. */}
      <PeriodFilter from={period.from} to={period.to} isCustom={isCustom} />

      <KuendigungsListe angekuendigt={angekuendigt} beendet={beendet} zeitraumText={zeitraumText} />
    </div>
  );
}
