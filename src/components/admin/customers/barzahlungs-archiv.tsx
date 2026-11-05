import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { produktText } from "@/lib/barzahlungen/offen";
import type { ArchivZeile } from "@/lib/barzahlungen/laden";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

function datum(wert: string): string {
  return new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Die Barzahlungs-Zyklen eines Kunden (PROJ-98).
 *
 * Dieselbe Abschrift wie das Archiv auf der Barzahlungsseite, nur andere
 * Richtung: Bei einer Reklamation ist der Kunde der Einstieg, nicht der
 * Zyklus. Keine zweite Quelle — `get_cash_archive_entries` mit Kunde statt
 * ohne.
 *
 * Bei jemandem, der nie bar gezahlt hat, verschwindet der Abschnitt **ganz**
 * statt leer dazustehen: Ein leerer Abschnitt sieht aus wie ein Fehler.
 *
 * `null` ist etwas anderes als „leer": Dann war das Archiv nicht lesbar, und
 * das muss dastehen. Sonst sähe ein Lesefehler aus wie „hat nie bar gezahlt" —
 * genau die Verwechslung, die diese Akte nicht machen darf.
 */
export function BarzahlungsArchiv({ zeilen }: { zeilen: ArchivZeile[] | null }) {
  if (zeilen !== null && zeilen.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-heading text-lg font-semibold">Barzahlungen</h3>
      {zeilen === null ? (
        <Alert variant="destructive">
          <AlertDescription>
            Das Archiv der Barzahlungen konnte nicht geladen werden. Ob dieser Kunde bar gezahlt
            hat, steht hier deshalb nicht — es heißt nicht, dass er es nicht getan hat.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zyklus</TableHead>
                <TableHead>Abo</TableHead>
                <TableHead>Geschuldet</TableHead>
                <TableHead>Gezahlt</TableHead>
                <TableHead>Offen</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zeilen.map((z) => {
                const offen = Math.round((z.betrag - z.gezahlt) * 100) / 100;
                return (
                  <TableRow key={z.zeileId}>
                    <TableCell className="whitespace-nowrap font-medium tabular-nums">
                      {datum(z.von)} – {datum(z.bis)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        {z.aboName}
                        {produktText(z) && (
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            {produktText(z)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {EUR.format(z.betrag)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {EUR.format(z.gezahlt)}
                    </TableCell>
                    {/* Teilweise bezahlt ist der Fall, um den es bei einer
                        Reklamation geht — deshalb steht der Rest als eigene
                        Spalte da und nicht nur als Differenz im Kopf. */}
                    <TableCell className="whitespace-nowrap font-medium tabular-nums">
                      {offen > 0.005 ? EUR.format(offen) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {z.notiz ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
