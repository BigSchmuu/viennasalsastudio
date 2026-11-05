import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/analytics/period";
import { eintragsZeilen, type Eintrag } from "@/lib/barzahlungen/offen";
import { ladeArchiv, ladeZyklen } from "@/lib/barzahlungen/laden";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { PeriodFilter } from "@/components/admin/analytics/period-filter";
import {
  BarzahlungsUebersicht,
  type EingesammeltZeile,
  type AboWahl,
} from "@/components/admin/barzahlungen/barzahlungs-uebersicht";

/** Der Tag nach einem gegebenen — fuer den Anfang des laufenden Zyklus. */
function tagDanach(tag: string): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Barzahlungen in der Verwaltung (PROJ-84).
 *
 * Eine Liste, von Hand geführt: eintragen, kassieren, entfernen, und zum neuen
 * Zahlungszyklus in einem Zug leeren. Daneben, was im Zeitraum eingesammelt
 * wurde — mit Tag und Namen, denn das ist der Nachweis.
 *
 * Hier wird direkt gelesen und nicht über die Funktion der Lehreransicht: Die
 * Verwaltung darf Abos und Mandate sehen, und die Frage ist eine andere — nicht
 * „wer gehört zu diesem Kurs", sondern „wer steht überhaupt auf der Liste".
 *
 * PROJ-98: Dazu das Archiv der abgeschlossenen Zyklen. Es kommt aus der
 * Datenbank, auch das Gezahlte je Zyklus — gerechnet wird hier nur die eine
 * Grenze „gehört diese Zahlung zum laufenden Zyklus", und deren Datum liefert
 * ebenfalls die Datenbank (siehe `barzahlung_bezahlt_laufend`).
 */
export default async function BarzahlungenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, isCustom } = resolvePeriod(params);
  const supabase = await createClient();

  const [eintragRes, zahlungRes, aboRes, mandatRes, aufschlagRes, eingesammeltRes] =
    await Promise.all([
    supabase
      .from("cash_entries")
      .select("id, customer_id, subscription_id, amount_due, note"),
    supabase.from("cash_payments").select("id, entry_id, amount, paid_on, created_at"),
    supabase
      .from("subscriptions")
      // PROJ-95: `dance_styles` mit — sonst stünde an einem Pass das Abzeichen
      // „Flatrate", weil beide kurslos sind.
      .select("id, customer_id, name, price, course_id, courses(name), dance_styles(name), profiles(full_name)")
      .eq("status", "active"),
    supabase.from("sepa_mandates").select("customer_id").is("revoked_at", null),
    // PROJ-87: Offene Aufschläge. Sie reisen im nächsten Lastschriftlauf mit —
    // wer kein Mandat hat, kommt aber in keinen Lauf, und der Betrag bliebe
    // ewig liegen. Deshalb steht er hier, wo die Barzahler verwaltet werden.
    supabase
      .from("subscription_surcharges")
      .select("id, customer_id, subscription_id, amount, reason")
      .is("collection_item_id", null),
    // Ohne eingebettete Beziehung: Die Typdatei wird hier von Hand gepflegt
    // (wie bei PROJ-62), und eine Beziehung, die sie nicht kennt, wäre nur ein
    // Kampf mit dem Typprüfer. Die Namen kommen gleich darunter in einem Zug.
    supabase
      .from("cash_payments")
      .select("id, paid_on, amount, customer_id, collected_by")
      .gte("paid_on", period.from)
      .lte("paid_on", period.to)
      .order("paid_on", { ascending: false }),
  ]);

  // Ein Lesefehler darf nicht als „niemand offen" durchgehen — dieselbe Lehre
  // wie bei „Nicht zugestellt" (PROJ-16).
  const fehler =
    eintragRes.error ??
    zahlungRes.error ??
    aboRes.error ??
    mandatRes.error ??
    aufschlagRes.error ??
    eingesammeltRes.error;
  if (fehler) {
    console.error("Barzahlungen nicht lesbar", fehler);
    throw new Error("Die Barzahlungen konnten nicht geladen werden");
  }

  // PROJ-98: Die abgeschlossenen Zyklen und ihre Abschriften. Beide werfen bei
  // einem Lesefehler — ein leeres Archiv heißt „noch nichts abgeschlossen",
  // ein kaputtes sieht genauso aus und bedeutet etwas völlig anderes.
  const [zyklen, archiv] = await Promise.all([ladeZyklen(supabase), ladeArchiv(supabase)]);

  // Der laufende Zyklus beginnt am Tag nach dem letzten Abschluss. Ohne
  // Abschluss gibt es keine Grenze: Dann gehört jede Zahlung zum laufenden
  // Zyklus.
  const letzterZyklus = zyklen[0] ?? null;
  const zyklusStart = letzterZyklus ? tagDanach(letzterZyklus.bis) : null;

  // Was aus dem jüngsten abgeschlossenen Zyklus je Abo offen blieb. Die Zahlen
  // kommen fertig aus der Datenbank; hier wird nur die Differenz gebildet.
  const restVorher = new Map<string, number>();
  if (letzterZyklus) {
    for (const zeile of archiv) {
      if (zeile.zyklusId !== letzterZyklus.zyklusId) continue;
      const offen = Math.round((zeile.betrag - zeile.gezahlt) * 100) / 100;
      if (offen > 0.005) restVorher.set(zeile.aboId, offen);
    }
  }

  // Was ein Abo im vorigen Zyklus schuldete — der Vorschlag für den Betrag und
  // das Merkmal der Gruppe „Im vorigen Zyklus" (PROJ-99).
  const vorigerBetrag = new Map<string, number>();
  if (letzterZyklus) {
    for (const zeile of archiv) {
      if (zeile.zyklusId === letzterZyklus.zyklusId) vorigerBetrag.set(zeile.aboId, zeile.betrag);
    }
  }

  const abos = new Map((aboRes.data ?? []).map((a) => [a.id, a]));
  const mitMandat = new Set((mandatRes.data ?? []).map((m) => m.customer_id));

  const bezahltJeEintrag = new Map<string, number>();
  const letzteJeEintrag = new Map<string, { tag: string; id: string; erfasst: string }>();
  for (const z of zahlungRes.data ?? []) {
    if (!z.entry_id) continue;
    // PROJ-98: Nur Zahlungen des laufenden Zyklus. Ein Eintrag, der einen
    // Abschluss überlebt hat, stünde sonst mit dem Geld von letztem Monat als
    // bezahlt da — und niemand sammelte etwas ein.
    if (zyklusStart && z.paid_on < zyklusStart) continue;
    bezahltJeEintrag.set(z.entry_id, (bezahltJeEintrag.get(z.entry_id) ?? 0) + Number(z.amount));
    const bisher = letzteJeEintrag.get(z.entry_id);
    if (!bisher || z.created_at > bisher.erfasst) {
      letzteJeEintrag.set(z.entry_id, { tag: z.paid_on, id: z.id, erfasst: z.created_at });
    }
  }

  const eintraege: Eintrag[] = (eintragRes.data ?? []).map((e) => {
    const abo = abos.get(e.subscription_id);
    const letzte = letzteJeEintrag.get(e.id);
    return {
      eintragId: e.id,
      kundeId: e.customer_id,
      kundeName: abo?.profiles?.full_name || "Unbenannter Kunde",
      aboId: e.subscription_id,
      aboName: abo?.courses?.name ?? abo?.name ?? "Flatrate",
      istFlatrate: abo?.course_id === null,
      passStil: abo?.dance_styles?.name ?? null,
      betrag: Number(e.amount_due),
      bezahlt: bezahltJeEintrag.get(e.id) ?? 0,
      letzteZahlung: letzte?.tag ?? null,
      notiz: e.note,
      letzteZahlungId: letzte?.id ?? null,
      // In der Verwaltung gibt es keinen „eigenen Kurs" — die Liste ist eine.
      eigenerKurs: true,
      restVorher: restVorher.get(e.subscription_id) ?? 0,
      vorherBis: letzterZyklus?.bis ?? null,
    };
  });

  const zeilen = eintragsZeilen(eintraege);

  // Wen der Betreiber eintragen kann: jedes aktive Abo, das noch nicht auf der
  // Liste steht. Ein gültiges Mandat hindert nicht — es kommt vor, dass jemand
  // einmal bar zahlt —, aber es wird genannt, weil dann auch die Lastschrift
  // zugreift.
  const schonDrauf = new Set((eintragRes.data ?? []).map((e) => e.subscription_id));
  const aboWahl: AboWahl[] = (aboRes.data ?? [])
    .filter((a) => !schonDrauf.has(a.id))
    .map((a) => ({
      aboId: a.id,
      kundeName: a.profiles?.full_name || "Unbenannter Kunde",
      aboName: a.courses?.name ?? a.name ?? "Flatrate",
      istFlatrate: a.course_id === null,
      passStil: a.dance_styles?.name ?? null,
      preis: a.price === null ? null : Number(a.price),
      hatMandat: mitMandat.has(a.customer_id),
      // PROJ-99: null heißt „stand im vorigen Zyklus nicht auf der Liste".
      vorigerBetrag: vorigerBetrag.get(a.id) ?? null,
    }))
    .sort((a, b) => a.kundeName.localeCompare(b.kundeName, "de"));

  // Namen für Kunden *und* Lehrkräfte in einem Zug: Ein entfernter Eintrag
  // steht nicht mehr oben in der Liste, die Zahlung von damals aber schon.
  const namensIds = Array.from(
    new Set(
      (eingesammeltRes.data ?? []).flatMap((z) =>
        [z.customer_id, z.collected_by].filter((id): id is string => !!id)
      )
    )
  );
  const namen = new Map<string, string>();
  if (namensIds.length > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", namensIds);
    for (const p of profile ?? []) namen.set(p.id, p.full_name || "Unbenannter Kunde");
  }

  const eingesammelt: EingesammeltZeile[] = (eingesammeltRes.data ?? []).map((z) => ({
    id: z.id,
    kundeId: z.customer_id,
    kundeName: namen.get(z.customer_id) ?? "Unbenannter Kunde",
    tag: z.paid_on,
    betrag: Number(z.amount),
    // Wer eingesammelt hat. Fehlt der Name, ist das Konto gelöscht — die
    // Zahlung bleibt trotzdem stehen, sie ist passiert.
    kassiertVon: z.collected_by ? (namen.get(z.collected_by) ?? "Gelöschtes Konto") : "—",
  }));

  // Nur die ohne gültiges Mandat: Bei allen anderen holt der nächste Lauf den
  // Aufschlag von selbst.
  const offeneAufschlaege = (aufschlagRes.data ?? [])
    .filter((a) => !mitMandat.has(a.customer_id))
    .map((a) => {
      const abo = abos.get(a.subscription_id);
      return {
        id: a.id,
        kundeName: abo?.profiles?.full_name || "Unbenannter Kunde",
        betrag: Number(a.amount),
        grund: a.reason,
      };
    });

  const spanne = (wert: string) => new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Barzahlungen</h2>
        <p className="text-sm text-muted-foreground">
          {/* Seit wann der laufende Zyklus läuft, steht an der Liste selbst —
              dort, wo es gebraucht wird, und nur einmal. */}
          Die Liste des laufenden Zahlungszyklus — von Hand geführt
        </p>
      </div>

      {/* Der Zeitraum wirkt nur auf das Eingesammelte. Ein offener Eintrag ist
          offen, unabhängig davon, welcher Monat oben steht. */}
      <PeriodFilter from={period.from} to={period.to} isCustom={isCustom} />

      <BarzahlungsUebersicht
        zeilen={zeilen}
        aboWahl={aboWahl}
        aufschlaege={offeneAufschlaege}
        eingesammelt={eingesammelt}
        zeitraumText={`Im Zeitraum ${spanne(period.from)} bis ${spanne(period.to)} eingesammelt.`}
        zyklen={zyklen}
        archiv={archiv}
        zyklusStart={zyklusStart}
        heute={heuteInWien()}
      />
    </div>
  );
}
