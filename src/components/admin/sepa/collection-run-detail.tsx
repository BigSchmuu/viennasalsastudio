"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  aendereLaufPositionsbetrag,
  entferneLaufPosition,
  fuegeLaufPositionHinzu,
  generateRunXml,
  gibLaufFrei,
  markItemBounced,
  verwirfLaufEntwurf,
} from "@/lib/actions/admin/sepa-collections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BetragDialog,
  PositionHinzufuegenDialog,
  type OffenePosition,
  type PositionsErgebnis,
} from "@/components/admin/sepa/positions-dialoge";
import { freigabeHindernis, istAenderbar, positionenSumme } from "@/lib/sepa/laeufe";

export type CollectionItemRow = {
  id: string;
  customerId: string;
  customerName: string;
  /** Abo-Name oder Veranstaltung — je nachdem, worauf die Position sich bezieht. */
  bezug: string;
  amount: number;
  bouncedAt: string | null;
};

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatZeitpunkt(wert: string): string {
  return new Date(wert).toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Ein Lastschriftlauf, in zwei Gestalten.
 *
 * Als **Entwurf** ist er eine Arbeitsliste: Beträge lassen sich ändern,
 * Positionen entfernen und ergänzen, der ganze Lauf verwerfen. Es gibt keine
 * Bankdatei — eine herunterladbare Datei, die noch nicht verbindlich ist,
 * könnte bei der Bank landen, während die Anwendung den Lauf für einen Entwurf
 * hält.
 *
 * Nach der **Freigabe** ist er ein Dokument: nur noch lesbar, dafür mit
 * Bankdatei und der Möglichkeit, Rücklastschriften zu vermerken.
 */
export function CollectionRunDetail({
  runId,
  items,
  freigegebenAm,
  freigegebenVon,
  offenePositionen,
  ueberfaellig,
}: {
  runId: string;
  items: CollectionItemRow[];
  freigegebenAm: string | null;
  freigegebenVon: string | null;
  offenePositionen: OffenePosition[];
  /** Entwurf, dessen Fälligkeitsdatum verstrichen ist. */
  ueberfaellig: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [laufendeAktion, setLaufendeAktion] = useState<string | null>(null);

  const [betragFuer, setBetragFuer] = useState<CollectionItemRow | null>(null);
  const [hinzufuegenOffen, setHinzufuegenOffen] = useState(false);
  const [entfernen, setEntfernen] = useState<CollectionItemRow | null>(null);
  const [verwerfenOffen, setVerwerfenOffen] = useState(false);
  const [freigebenOffen, setFreigebenOffen] = useState(false);

  const entwurf = istAenderbar(freigegebenAm);
  const summe = positionenSumme(items);
  const hindernis = freigabeHindernis(freigegebenAm, items.length);

  async function ausfuehren(
    kennung: string,
    vorgang: () => Promise<PositionsErgebnis>,
    erfolgsmeldung: string
  ) {
    setError(null);
    setLaufendeAktion(kennung);
    try {
      const ergebnis = await vorgang();
      if ("error" in ergebnis) {
        setError(ergebnis.error);
        return ergebnis;
      }
      toast.success(erfolgsmeldung);
      router.refresh();
      return ergebnis;
    } finally {
      setLaufendeAktion(null);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const result = await generateRunXml(runId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      downloadXml(result.xml, result.filename);
    } finally {
      setDownloading(false);
    }
  }

  async function handleToggleBounced(item: CollectionItemRow) {
    setTogglingId(item.id);
    setError(null);
    try {
      const result = await markItemBounced(item.id, item.bouncedAt === null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-muted/50 px-4 py-3">
        <div className="text-sm">
          <p className="font-medium">
            {items.length} {items.length === 1 ? "Position" : "Positionen"} · {formatPrice(summe)}
          </p>
          {entwurf ? (
            <p className="text-muted-foreground">
              Entwurf — es wurden noch keine Rechnungen erstellt und niemand benachrichtigt.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Freigegeben am {formatZeitpunkt(freigegebenAm!)}
              {freigegebenVon && <> von {freigegebenVon}</>}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {entwurf ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setHinzufuegenOffen(true)}>
                Position hinzufügen
              </Button>
              <Button variant="outline" size="sm" onClick={() => setVerwerfenOffen(true)}>
                Entwurf verwerfen
              </Button>
              <Button
                size="sm"
                disabled={hindernis !== null || laufendeAktion !== null}
                onClick={() => setFreigebenOffen(true)}
              >
                Lauf freigeben
              </Button>
            </>
          ) : (
            <Button type="button" disabled={downloading} onClick={handleDownload}>
              {downloading ? "Wird erstellt…" : "SEPA-XML herunterladen"}
            </Button>
          )}
        </div>
      </div>

      {/* Ein vergessener Entwurf bucht nichts ab, und niemand merkt es. Nur
          warnen, nicht sperren: Später einzuziehen kann Absicht sein. */}
      {ueberfaellig && (
        <Alert>
          <AlertDescription>
            Das Fälligkeitsdatum dieses Entwurfs ist verstrichen — es wurde nichts abgebucht. Gib
            ihn frei, wenn der Einzug noch stattfinden soll, oder verwirf ihn und lege einen Lauf
            mit aktuellem Datum an.
          </AlertDescription>
        </Alert>
      )}

      {hindernis === "keine_positionen" && (
        <Alert>
          <AlertDescription>
            Dieser Entwurf hat keine Positionen mehr. Füge eine hinzu oder verwirf ihn — freigeben
            lässt sich ein leerer Lauf nicht.
          </AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Keine Positionen in diesem Lauf.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunde</TableHead>
              <TableHead>Bezug</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              {!entwurf && <TableHead>Status</TableHead>}
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/kunden/${item.customerId}`} className="hover:underline">
                    {item.customerName}
                  </Link>
                </TableCell>
                <TableCell>{item.bezug}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPrice(item.amount)}</TableCell>
                {!entwurf && (
                  <TableCell>
                    {item.bouncedAt ? (
                      <Badge style={{ backgroundColor: "#e63946", color: "white" }}>
                        Rückgebucht
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Offen</Badge>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {entwurf ? (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setBetragFuer(item)}>
                        Betrag ändern
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEntfernen(item)}>
                        Entfernen
                      </Button>
                    </div>
                  ) : (
                    /* Eine Rücklastschrift gibt es erst, wenn eingezogen wurde. */
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={togglingId === item.id}
                      onClick={() => handleToggleBounced(item)}
                    >
                      {item.bouncedAt ? "Als offen markieren" : "Als rückgebucht markieren"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <BetragDialog
        offen={betragFuer !== null}
        onOffenChange={(offen) => !offen && setBetragFuer(null)}
        kundenname={betragFuer?.customerName ?? ""}
        bisher={betragFuer?.amount ?? 0}
        onBestaetigen={async (betrag) => {
          const ergebnis = await ausfuehren(
            "betrag",
            () => aendereLaufPositionsbetrag(betragFuer!.id, betrag),
            "Betrag geändert"
          );
          if ("success" in ergebnis) setBetragFuer(null);
          return ergebnis;
        }}
      />

      <PositionHinzufuegenDialog
        offen={hinzufuegenOffen}
        onOffenChange={setHinzufuegenOffen}
        offenePositionen={offenePositionen}
        onBestaetigen={async (auswahl, betrag) =>
          ausfuehren(
            "hinzufuegen",
            () => fuegeLaufPositionHinzu(runId, { id: auswahl.id, art: auswahl.art }, betrag),
            "Position hinzugefügt"
          )
        }
      />

      <AlertDialog open={entfernen !== null} onOpenChange={(offen) => !offen && setEntfernen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Position entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {entfernen?.customerName} wird in diesem Lauf nicht abgebucht. Verrechnetes Guthaben
              geht vollständig an den Kunden zurück.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await ausfuehren(
                  "entfernen",
                  () => entferneLaufPosition(entfernen!.id),
                  "Position entfernt"
                );
                setEntfernen(null);
              }}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={verwerfenOffen} onOpenChange={setVerwerfenOffen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Entwurf verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Lauf und alle {items.length} Positionen werden entfernt. Verrechnetes Guthaben
              steht den Kunden wieder zur Verfügung. Rückgängig machen lässt sich das nicht — den
              Lauf neu anzulegen erzeugt ihn aber jederzeit wieder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                ausfuehren("verwerfen", () => verwirfLaufEntwurf(runId), "Entwurf verworfen")
              }
            >
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={freigebenOffen} onOpenChange={setFreigebenOffen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Lauf freigeben?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-foreground">
                  <span className="text-2xl font-bold tabular-nums">{formatPrice(summe)}</span>{" "}
                  <span className="text-muted-foreground">
                    aus {items.length} {items.length === 1 ? "Position" : "Positionen"}
                  </span>
                </p>
                <p>
                  Damit werden die Rechnungen erstellt und die Vorabankündigungen an die Kunden
                  verschickt. Anschließend lässt sich am Lauf nichts mehr ändern — erst danach gibt
                  es die Bankdatei.
                </p>
                <p>Prüf die Beträge oben noch einmal, bevor du fortfährst.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück zur Liste</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => ausfuehren("freigeben", () => gibLaufFrei(runId), "Lauf freigegeben")}
            >
              Freigeben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
