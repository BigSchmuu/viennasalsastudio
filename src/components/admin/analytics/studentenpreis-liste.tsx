import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KundenLink } from "@/components/admin/customers/kunden-link";

/**
 * PROJ-102: Was beim Studierendenpreis ansteht.
 *
 * Zwei Dinge, die der Betreiber wissen will und die ohne diese Karte nirgends
 * stünden: welche Preisumstellungen angekündigt sind (damit eine Rückfrage ihn
 * nicht unvorbereitet trifft), und welche Studierendenabos sich **nicht**
 * beurteilen lassen, weil am Kunden kein Geburtsdatum hinterlegt ist. Für die
 * zweite Gruppe passiert nichts — weder automatisch noch still.
 *
 * Ohne beides erscheint die Karte gar nicht: Eine leere Liste ist eine Zeile,
 * die man jeden Tag liest und nie braucht.
 */
export type UmstellungsZeile = {
  aboId: string;
  kundeId: string;
  kundeName: string;
  aboName: string;
  alt: number | null;
  neu: number | null;
  datum: string;
};

export type OffeneZeile = {
  aboId: string;
  kundeId: string;
  kundeName: string;
  aboName: string;
  preis: number | null;
};

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

function datumKurz(iso: string): string {
  const [jahr, monat, tag] = iso.split("-");
  return `${tag}.${monat}.${jahr}`;
}

function betrag(wert: number | null): string {
  return wert === null ? "—" : EUR.format(wert);
}

export function StudentenpreisListe({
  angekuendigt,
  ohneGeburtsdatum,
}: {
  angekuendigt: UmstellungsZeile[];
  ohneGeburtsdatum: OffeneZeile[];
}) {
  if (angekuendigt.length === 0 && ohneGeburtsdatum.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Studierendenpreis</CardTitle>
        <CardDescription>
          Der Studierendenpreis gilt bis einschließlich 27 Jahre. Eine Umstellung wird einen
          vollen Zyklus vorher angekündigt; wer bis dahin kündigt, zahlt den neuen Beitrag nie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {angekuendigt.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Angekündigte Umstellungen</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ab</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Abo</TableHead>
                    <TableHead className="text-right">Beitrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {angekuendigt.map((z) => (
                    <TableRow key={z.aboId}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {datumKurz(z.datum)}
                      </TableCell>
                      <TableCell>
                        <KundenLink kundeId={z.kundeId}>{z.kundeName}</KundenLink>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{z.aboName}</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {betrag(z.alt)} → {betrag(z.neu)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {ohneGeburtsdatum.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Ohne Geburtsdatum — nicht beurteilbar</h3>
            <Alert>
              <AlertDescription>
                Diese Abos laufen zum Studierendenpreis, aber am Kunden ist kein Geburtsdatum
                hinterlegt. Hier passiert nichts, bis es nachgetragen ist — weder eine
                Ankündigung noch eine Umstellung. Beim nächsten Speichern seines Profils wird
                der Kunde danach gefragt.
              </AlertDescription>
            </Alert>
            <ul className="space-y-1 text-sm">
              {ohneGeburtsdatum.map((z) => (
                <li key={z.aboId} className="flex flex-wrap items-baseline gap-x-2">
                  <KundenLink kundeId={z.kundeId}>{z.kundeName}</KundenLink>
                  <span className="text-muted-foreground">
                    {z.aboName} · {betrag(z.preis)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Einen Beitrag von Hand zu ändern hebt eine angekündigte Umstellung auf.{" "}
          <Link href="/admin/benachrichtigungen" className="underline">
            Der Text der Ankündigung
          </Link>{" "}
          ist dort pflegbar.
        </p>
      </CardContent>
    </Card>
  );
}
