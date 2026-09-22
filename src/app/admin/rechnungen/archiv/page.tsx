import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Beleg } from "@/components/invoices/beleg";
import { PrintButton } from "@/components/invoices/print-button";
import { Button } from "@/components/ui/button";
import { ladeBelegeImZeitraum, ladeStammdaten } from "@/lib/belege/laden";
import { belegAnzahlText, zeitraumText } from "@/lib/belege/zeitraum";

/**
 * Das Belegarchiv: alle Belege eines Zeitraums am Stück (PROJ-64).
 *
 * Zweck ist die Aufbewahrungspflicht — sieben Jahre, § 132 BAO. Der
 * Zahlen-Export liefert dem Steuerberater die Summen, dieses Archiv liefert
 * die Belege selbst, in derselben Form, die auch der Kunde sieht. Gedruckt
 * wird über den Browser („Als PDF sichern"); eine erzeugte PDF-Datei bräuchte
 * ein zweites Beleglayout, und zwei Fassungen desselben Belegs sind bei einem
 * Buchhaltungsbeleg das größere Übel.
 */

function formatEUR(betrag: number): string {
  return betrag.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export default async function BelegarchivPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>;
}) {
  const { from, to, q } = await searchParams;
  const supabase = await createClient();

  const [belege, stammdaten] = await Promise.all([
    ladeBelegeImZeitraum(supabase, { von: from, bis: to, suche: q }),
    ladeStammdaten(supabase),
  ]);

  const summe = belege.reduce((gesamt, beleg) => gesamt + beleg.brutto, 0);
  const zurueck = `/admin/rechnungen${from || to || q ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}` : ""}`;

  return (
    <div>
      {/*
        Im Druck bleibt nur das Archiv übrig. Die Verwaltung hat eine Kopfzeile,
        eine Navigation und Hinweiskästen — die gehören nicht in ein
        Buchhaltungsarchiv. `visibility` statt `display`, weil der Rahmen sonst
        zusammenfällt und die erste Seite zerrissen aussieht.
      */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #belegarchiv, #belegarchiv * { visibility: visible !important; }
          #belegarchiv { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .beleg-blatt { break-before: page; }
          .beleg-blatt:first-of-type { break-before: auto; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold">Belege zum Aufbewahren</h2>
          <p className="text-sm text-muted-foreground">
            {zeitraumText(from, to)} · {belegAnzahlText(belege.length)} · {formatEUR(summe)}
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Drucken und als PDF sichern. Die Datei gehört an einen Ort, der sieben Jahre hält — die
            täglichen Sicherungen der Datenbank sind dafür nicht gedacht.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={zurueck}>Zurück zur Liste</Link>
          </Button>
          {belege.length > 0 && <PrintButton />}
        </div>
      </div>

      {belege.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          In diesem Zeitraum gibt es keine Belege.
        </p>
      ) : (
        <div id="belegarchiv" className="space-y-8">
          {/* Nur im Druck: Ohne Kopf wüsste niemand, welcher Zeitraum in der
              Datei steckt — der Bildschirmkopf ist dann ja ausgeblendet. */}
          <div className="hidden print:block">
            <p className="font-heading text-lg font-bold">{stammdaten.firma}</p>
            <p className="text-sm">
              Belege {zeitraumText(from, to)} · {belegAnzahlText(belege.length)} · {formatEUR(summe)}
            </p>
          </div>

          {belege.map((beleg) => (
            <div key={beleg.id} className="beleg-blatt mx-auto max-w-2xl">
              <Beleg beleg={beleg} stammdaten={stammdaten} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
