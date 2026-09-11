import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { STUDIO_TIMEZONE } from "@/lib/constants/zeitzone";

export type FehlgeschlageneSendung = {
  id: string;
  ereignis: string;
  kunde: string;
  perEmail: string | null;
  perPush: string | null;
  fehler: string | null;
  zeitpunkt: string | null;
};

/**
 * „Nicht zugestellt" (PROJ-16).
 *
 * Ein fehlgeschlagener Versand stand bisher nur in der Warteschlange: Die
 * Zeile bekam `email_status = 'failed'` und einen Fehlertext, und beides las
 * niemand. Eine Buchungsbestätigung, die nie ankam, erfuhr der Betreiber vom
 * Kunden — oder gar nicht.
 *
 * Bewusst keine Wiederholen-Schaltfläche: Die meisten Fehlschläge sind keine
 * Aussetzer, sondern falsche oder tote Adressen. Ein Knopf, der dann
 * wortlos denselben Fehler erzeugt, verspricht eine Lösung, die er nicht hat.
 * Was der Betreiber braucht, ist zu *wissen*, dass etwas fehlt — den Rest
 * klärt er mit dem Kunden.
 */
function zeitpunkt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: STUDIO_TIMEZONE,
  });
}

export function FailedDeliveries({
  sendungen,
  lesefehler,
}: {
  sendungen: FehlgeschlageneSendung[];
  lesefehler: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-heading text-lg font-bold">Nicht zugestellt</h3>
        <p className="text-sm text-muted-foreground">
          Benachrichtigungen, die nicht hinausgingen. Meist steckt eine falsche oder tote
          E-Mail-Adresse dahinter — dann hilft nur, den Kunden anders zu erreichen.
        </p>
      </div>

      {/* Eine leere Liste nach einem Lesefehler sähe aus wie „alles zugestellt".
          Das ist der gefährlichere der beiden Zustände, also wird er benannt. */}
      {lesefehler ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          Die Liste konnte nicht geladen werden. Ob etwas fehlgeschlagen ist, lässt sich hier
          gerade nicht sagen.
        </p>
      ) : sendungen.length === 0 ? (
        <p className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Alles zugestellt.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Wann</TableHead>
              <TableHead>Wer</TableHead>
              <TableHead>Anlass</TableHead>
              <TableHead>Weg</TableHead>
              <TableHead>Grund</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sendungen.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="whitespace-nowrap tabular-nums">{zeitpunkt(s.zeitpunkt)}</TableCell>
                <TableCell className="font-medium">{s.kunde}</TableCell>
                <TableCell className="text-muted-foreground">{s.ereignis}</TableCell>
                <TableCell className="space-x-1">
                  {s.perEmail === "failed" && <Badge variant="outline">E-Mail</Badge>}
                  {s.perPush === "failed" && <Badge variant="outline">Push</Badge>}
                </TableCell>
                {/* Der Fehlertext kommt vom Mailserver und kann lang sein. Er
                    steht trotzdem vollständig da: Gekürzt wäre er oft genau um
                    den Teil kürzer, der erklärt, was zu tun ist. */}
                <TableCell className="text-xs text-muted-foreground">{s.fehler ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
