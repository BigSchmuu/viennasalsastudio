import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { laufzeit, type Kuendigung } from "@/lib/admin/kuendigungen";

function datum(wert: string | null): string {
  if (!wert) return "—";
  return new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Eine der beiden Listen (PROJ-79).
 *
 * Zwei Tabellen und nicht eine mit Spalte „Zustand": Für die angekündigten kann
 * der Betreiber noch etwas tun, für die beendeten nicht mehr. Das ist der
 * Unterschied, um den es geht — und er verschwindet, sobald beides untereinander
 * in derselben Liste steht.
 */
function Abschnitt({
  titel,
  hinweis,
  leerText,
  kuendigungen,
  zeigeGekuendigtAm,
}: {
  titel: string;
  hinweis: string;
  leerText: string;
  kuendigungen: Kuendigung[];
  zeigeGekuendigtAm: boolean;
}) {
  return (
    <Card role="region" aria-labelledby={`kuendigungen-${zeigeGekuendigtAm ? "beendet" : "offen"}`}>
      <CardHeader>
        <CardTitle
          id={`kuendigungen-${zeigeGekuendigtAm ? "beendet" : "offen"}`}
          className="font-heading text-lg"
        >
          {titel}
          <Badge variant="outline" className="ml-2 align-middle">
            {kuendigungen.length}
          </Badge>
        </CardTitle>
        <CardDescription>{hinweis}</CardDescription>
      </CardHeader>
      <CardContent>
        {kuendigungen.length === 0 ? (
          // Eine leere Fläche ließe offen, ob nichts gekündigt wurde oder die
          // Liste nicht geladen wurde.
          <p className="text-sm text-muted-foreground">{leerText}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Abo</TableHead>
                  <TableHead>{zeigeGekuendigtAm ? "Beendet am" : "Endet am"}</TableHead>
                  <TableHead>Laufzeit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kuendigungen.map((k) => (
                  <TableRow key={k.aboId}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/kunden/${k.kundeId}`} className="hover:underline">
                        {k.kundeName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{k.aboName}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {datum(k.wirksamAb)}
                    </TableCell>
                    {/* Die Laufzeit beantwortet, ob jemand nach zwei Monaten geht
                        oder nach zwei Jahren. */}
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {laufzeit(k.beginn, k.wirksamAb)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KuendigungsListe({
  angekuendigt,
  beendet,
  zeitraumText,
}: {
  angekuendigt: Kuendigung[];
  beendet: Kuendigung[];
  zeitraumText: string;
}) {
  return (
    <div className="space-y-6">
      {/* Die angekündigten zuerst: Dort ist noch eine Entscheidung möglich. */}
      <Abschnitt
        titel="Angekündigt — läuft noch"
        hinweis="Gekündigt, aber noch nicht beendet. Bis zum Stichtag ist der Platz belegt."
        leerText="Derzeit ist keine Kündigung angekündigt."
        kuendigungen={angekuendigt}
        zeigeGekuendigtAm={false}
      />
      <Abschnitt
        titel="Beendet"
        hinweis={zeitraumText}
        leerText="In diesem Zeitraum wurde kein Abo beendet."
        kuendigungen={beendet}
        zeigeGekuendigtAm={true}
      />
    </div>
  );
}
