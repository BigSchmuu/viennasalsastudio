import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Belege laden — einzeln oder als ganzer Zeitraum (PROJ-64).
 *
 * Eine Quelle für beide Auftritte: die Einzelseite eines Belegs und das
 * Belegarchiv der Verwaltung. Bis PROJ-64 stand die Abfrage nur auf der
 * Einzelseite; ein Archiv daneben hätte sie nachgebaut, und spätestens beim
 * nächsten Pflichtfeld wäre eine der beiden Fassungen unvollständig gewesen.
 *
 * Wichtig für den Zeitraum: Die Zahl der Abfragen hängt **nicht** an der Zahl
 * der Belege. Ein Jahrgang wird mit denselben vier Abfragen geladen wie ein
 * einzelner Monat.
 */

type Client = SupabaseClient<Database>;

const BELEG_SPALTEN =
  "id, invoice_number, invoice_date, description, gross_amount, vat_rate, bounced_at, document_type, cancels_invoice_id, reason, profiles(full_name)";

/** Die Stammdaten des Studios, wie sie auf jedem Beleg stehen. */
export type Stammdaten = {
  firma: string;
  adresse: string | null;
  uid: string | null;
};

/** Ein Beleg mit allem, was auf ihm gedruckt wird. */
export type BelegDaten = {
  id: string;
  nummer: string;
  datum: string;
  bezeichnung: string;
  brutto: number;
  ustSatz: number;
  art: "invoice" | "cancellation" | "credit_note";
  zurueckgebucht: boolean;
  grund: string | null;
  kunde: string;
  /** Bei Storno und Gutschrift: die Rechnung, die sie aufheben. */
  bezug: { nummer: string; datum: string } | null;
  /** Bei Rechnungen: die Belege, die sie ganz oder teilweise aufheben. */
  aufhebungen: { nummer: string; brutto: number; art: string }[];
};

type Zeile = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  description: string;
  gross_amount: number;
  vat_rate: number;
  bounced_at: string | null;
  document_type: string;
  cancels_invoice_id: string | null;
  reason: string | null;
  profiles: { full_name: string | null } | null;
};

function alsBeleg(
  zeile: Zeile,
  bezuege: Map<string, { nummer: string; datum: string }>,
  aufhebungen: Map<string, { nummer: string; brutto: number; art: string }[]>
): BelegDaten {
  return {
    id: zeile.id,
    nummer: zeile.invoice_number,
    datum: zeile.invoice_date,
    bezeichnung: zeile.description,
    brutto: Number(zeile.gross_amount),
    ustSatz: Number(zeile.vat_rate),
    art: zeile.document_type as BelegDaten["art"],
    zurueckgebucht: Boolean(zeile.bounced_at),
    grund: zeile.reason,
    // Ein gelöschtes Konto löscht keinen Beleg — dann steht hier derselbe
    // Strich wie in der Liste.
    kunde: zeile.profiles?.full_name ?? "—",
    bezug: zeile.cancels_invoice_id ? (bezuege.get(zeile.cancels_invoice_id) ?? null) : null,
    aufhebungen: aufhebungen.get(zeile.id) ?? [],
  };
}

export async function ladeStammdaten(supabase: Client): Promise<Stammdaten> {
  const { data } = await supabase
    .from("invoice_settings")
    .select("company_name, address, uid_number")
    .limit(1)
    .single();
  return {
    firma: data?.company_name || "—",
    adresse: data?.address ?? null,
    uid: data?.uid_number ?? null,
  };
}

/** Die Bezüge und Aufhebungen zu einer Menge von Belegen — zwei Abfragen, egal wie viele. */
async function ladeVerweise(supabase: Client, zeilen: Zeile[]) {
  const bezugsIds = [...new Set(zeilen.map((z) => z.cancels_invoice_id).filter(Boolean))] as string[];
  const rechnungsIds = zeilen.filter((z) => z.document_type === "invoice").map((z) => z.id);

  const [bezugRes, aufhebungRes] = await Promise.all([
    bezugsIds.length > 0
      ? supabase.from("invoices").select("id, invoice_number, invoice_date").in("id", bezugsIds)
      : Promise.resolve({ data: [] as { id: string; invoice_number: string; invoice_date: string }[] }),
    rechnungsIds.length > 0
      ? supabase
          .from("invoices")
          .select("cancels_invoice_id, invoice_number, gross_amount, document_type")
          .in("cancels_invoice_id", rechnungsIds)
          .order("invoice_number", { ascending: true })
      : Promise.resolve({
          data: [] as {
            cancels_invoice_id: string | null;
            invoice_number: string;
            gross_amount: number;
            document_type: string;
          }[],
        }),
  ]);

  const bezuege = new Map<string, { nummer: string; datum: string }>();
  for (const b of bezugRes.data ?? []) {
    bezuege.set(b.id, { nummer: b.invoice_number, datum: b.invoice_date });
  }

  const aufhebungen = new Map<string, { nummer: string; brutto: number; art: string }[]>();
  for (const a of aufhebungRes.data ?? []) {
    if (!a.cancels_invoice_id) continue;
    const liste = aufhebungen.get(a.cancels_invoice_id) ?? [];
    liste.push({ nummer: a.invoice_number, brutto: Number(a.gross_amount), art: a.document_type });
    aufhebungen.set(a.cancels_invoice_id, liste);
  }

  return { bezuege, aufhebungen };
}

/** Ein einzelner Beleg — oder `null`, wenn es ihn nicht gibt oder er nicht sichtbar ist. */
export async function ladeBeleg(supabase: Client, id: string): Promise<BelegDaten | null> {
  const { data } = await supabase.from("invoices").select(BELEG_SPALTEN).eq("id", id).maybeSingle();
  if (!data) return null;

  const zeile = data as unknown as Zeile;
  const { bezuege, aufhebungen } = await ladeVerweise(supabase, [zeile]);
  return alsBeleg(zeile, bezuege, aufhebungen);
}

/**
 * Alle Belege eines Zeitraums, chronologisch aufsteigend.
 *
 * Aufsteigend, anders als in der Verwaltungsliste: Ein Archiv liest sich wie
 * ein Journal, vom ersten zum letzten Beleg des Zeitraums.
 */
export async function ladeBelegeImZeitraum(
  supabase: Client,
  { von, bis, suche }: { von?: string; bis?: string; suche?: string }
): Promise<BelegDaten[]> {
  let abfrage = supabase
    .from("invoices")
    .select(BELEG_SPALTEN)
    .order("invoice_date", { ascending: true })
    .order("invoice_number", { ascending: true });

  if (von) abfrage = abfrage.gte("invoice_date", von);
  if (bis) abfrage = abfrage.lte("invoice_date", bis);

  const { data } = await abfrage;
  let zeilen = (data ?? []) as unknown as Zeile[];

  // Dieselbe Namenssuche wie im Zahlen-Export, damit beide Ausgaben bei
  // gleichem Zeitraum dieselben Belege enthalten.
  if (suche) {
    const gesucht = suche.toLowerCase();
    zeilen = zeilen.filter((z) => (z.profiles?.full_name ?? "").toLowerCase().includes(gesucht));
  }

  const { bezuege, aufhebungen } = await ladeVerweise(supabase, zeilen);
  return zeilen.map((z) => alsBeleg(z, bezuege, aufhebungen));
}
