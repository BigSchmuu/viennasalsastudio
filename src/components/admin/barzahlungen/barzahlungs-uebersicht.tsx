import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { offeneSumme, zustandText, type BarzahlerZeile } from "@/lib/barzahlungen/offen";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export type EingesammeltZeile = {
  id: string;
  kundeId: string;
  kundeName: string;
  tag: string;
  betrag: number;
  kassiertVon: string;
};

function datum(wert: string): string {
  return new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Barzahlungen in der Verwaltung (PROJ-81).
 *
 * Zwei Listen, weil zwei Fragen: Wer ist offen — dort ist etwas zu tun. Und was
 * ist hereingekommen — dort ist nichts zu tun, aber es muss nachvollziehbar
 * sein, von wem.
 */
export function BarzahlungsUebersicht({
  zeilen,
  eingesammelt,
  zeitraumText,
}: {
  zeilen: BarzahlerZeile[];
  eingesammelt: EingesammeltZeile[];
  zeitraumText: string;
}) {
  const offene = zeilen.filter((z) => z.offen);
  const summeOffen = offeneSumme(zeilen);
  const summeEingesammelt = eingesammelt.reduce((s, z) => s + z.betrag, 0);

  return (
    <div className="space-y-6">
      <Card role="region" aria-labelledby="barzahlungen-offen">
        <CardHeader>
          <CardTitle id="barzahlungen-offen" className="font-heading text-lg">
            Offen
            <Badge variant="outline" className="ml-2 align-middle">
              {offene.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Barzahler, deren Beitrag für den laufenden Zyklus noch fehlt — über alle Kurse, ohne
            Zeitraumgrenze.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offene.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Derzeit ist keine Barzahlung offen.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm">
                <span className="font-medium">Summe offen:</span>{" "}
                <span className="tabular-nums">{EUR.format(summeOffen)}</span>
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Abo</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Zuletzt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offene.map((z) => (
                      <TableRow key={z.aboId}>
                        <TableCell className="font-medium">
                          <Link href={`/admin/kunden/${z.kundeId}`} className="hover:underline">
                            {z.kundeName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {/* Ein Blockelement, kein Absatz-Element: Das Badge ist
                              ein div, und in einem span zerlegt der Browser den
                              Baum — der Sentry-Fehler vom 2026-09-27. */}
                          <div className="flex flex-wrap items-center gap-2">
                            {z.aboName}
                            {z.istFlatrate && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Flatrate
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {z.betrag === null || z.betrag <= 0 ? "—" : EUR.format(z.betrag)}
                        </TableCell>
                        {/* „Kein Preis am Abo" steht hier als Zustand: Die
                            Verwaltung ist die Stelle, die das beheben kann. */}
                        <TableCell className="text-sm text-muted-foreground">
                          {z.letzteBarzahlung ? datum(z.letzteBarzahlung) : zustandText(z)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card role="region" aria-labelledby="barzahlungen-eingesammelt">
        <CardHeader>
          <CardTitle id="barzahlungen-eingesammelt" className="font-heading text-lg">
            Eingesammelt
            <Badge variant="outline" className="ml-2 align-middle">
              {eingesammelt.length}
            </Badge>
          </CardTitle>
          <CardDescription>{zeitraumText}</CardDescription>
        </CardHeader>
        <CardContent>
          {eingesammelt.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              In diesem Zeitraum wurde keine Barzahlung erfasst.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm">
                <span className="font-medium">Summe im Zeitraum:</span>{" "}
                <span className="tabular-nums">{EUR.format(summeEingesammelt)}</span>
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Kassiert von</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eingesammelt.map((z) => (
                      <TableRow key={z.id}>
                        <TableCell className="font-medium">
                          <Link href={`/admin/kunden/${z.kundeId}`} className="hover:underline">
                            {z.kundeName}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {datum(z.tag)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {EUR.format(z.betrag)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{z.kassiertVon}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
