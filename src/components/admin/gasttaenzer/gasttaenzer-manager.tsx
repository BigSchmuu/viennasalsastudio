"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ausschreiben,
  ausschreibungZurueckziehen,
  gasttaenzerAusschliessen,
  gasttaenzerWiederZulassen,
  type AusschreibungZeile,
  type SchieflageZeile,
  type TeilnehmerZeile,
} from "@/lib/actions/admin/gasttaenzer";
import { LEVEL_NAME, LEVEL_REIHE, eineStufeUeber, type Kurslevel } from "@/lib/gasttaenzer/level";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type KursOption = {
  id: string;
  name: string;
  level: string | null;
  termine: string[];
};

const ROLLE_NAME: Record<string, string> = {
  leader: "Leader",
  follower: "Follower",
  both: "Beides",
};

function datumLang(datum: string): string {
  return new Date(`${datum}T12:00:00`).toLocaleDateString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Vienna",
  });
}

export function GasttaenzerManager({
  schieflage,
  ausschreibungen,
  teilnehmer,
  kurse,
}: {
  schieflage: SchieflageZeile[];
  ausschreibungen: AusschreibungZeile[];
  teilnehmer: TeilnehmerZeile[];
  kurse: KursOption[];
}) {
  const [dialogOffen, setDialogOffen] = useState(false);
  const [vorbelegung, setVorbelegung] = useState<{ kursId: string; rolle: string; anzahl: number } | null>(
    null
  );
  const [zeigeErledigte, setZeigeErledigte] = useState(false);

  // „Erledigt" heißt: zurückgezogen oder alle Plätze vergeben. Beides braucht
  // keine Aufmerksamkeit mehr — aber ganz verschwinden soll es nicht, sonst
  // ließe sich nicht mehr nachsehen, was für Dienstag ausgeschrieben war.
  const erledigt = ausschreibungen.filter((a) => a.zurueckgezogenAm || a.zusagen >= a.plaetze);
  const offen = ausschreibungen.filter((a) => !a.zurueckgezogenAm && a.zusagen < a.plaetze);
  const sichtbar = zeigeErledigte ? ausschreibungen : offen;

  function ausschreibenFuer(zeile: SchieflageZeile) {
    setVorbelegung({ kursId: zeile.courseId, rolle: zeile.fehlendeRolle, anzahl: zeile.fehlendeAnzahl });
    setDialogOffen(true);
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-heading text-lg font-semibold">Aus der Balance</h3>
            <p className="text-sm text-muted-foreground">
              Kurse, deren Rollendifferenz die eingestellte Grenze überschreitet. Gezählt wird wie beim
              Buchen — nach Anmeldungen, nicht danach, wer am Abend wirklich kommt.
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setVorbelegung(null);
              setDialogOffen(true);
            }}
          >
            Plätze ausschreiben
          </Button>
        </div>

        {schieflage.length === 0 ? (
          <p className="rounded-card border border-dashed border-border p-4 text-sm text-muted-foreground">
            Gerade ist nichts zu tun — kein Kurs überschreitet seine Grenze. Ausschreiben kannst du
            trotzdem jederzeit, etwa wenn du weißt, dass am Dienstag drei Follower fehlen.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kurs</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead>Follower</TableHead>
                <TableHead>Es fehlen</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schieflage.map((z) => (
                <TableRow key={z.courseId}>
                  <TableCell className="font-medium">{z.kursName}</TableCell>
                  <TableCell className="tabular-nums">{z.leader}</TableCell>
                  <TableCell className="tabular-nums">{z.follower}</TableCell>
                  <TableCell>
                    {z.fehlendeAnzahl} × {ROLLE_NAME[z.fehlendeRolle]}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => ausschreibenFuer(z)}>
                      Plätze ausschreiben
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-heading text-lg font-semibold">Laufende Ausschreibungen</h3>
            <p className="text-sm text-muted-foreground">
              Zusagen sind bis zum Kursbeginn möglich. Ziehst du eine Ausschreibung zurück, werden bereits
              Zugesagte abgesagt und benachrichtigt.
            </p>
          </div>
          {erledigt.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setZeigeErledigte((z) => !z)}>
              {zeigeErledigte
                ? "Erledigte ausblenden"
                : `Erledigte anzeigen (${erledigt.length})`}
            </Button>
          ) : null}
        </div>

        {sichtbar.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {ausschreibungen.length === 0
              ? "Nichts ausgeschrieben."
              : "Nichts Offenes — alles vergeben oder zurückgezogen."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kurs</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead>Gesucht</TableHead>
                <TableHead>Zusagen</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sichtbar.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.kursName}</TableCell>
                  <TableCell>{datumLang(a.termin)}</TableCell>
                  <TableCell>
                    {ROLLE_NAME[a.rolle]}
                    {a.mindeststufe ? (
                      <span className="block text-xs text-muted-foreground">
                        ab {LEVEL_NAME[a.mindeststufe as Kurslevel]}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {a.zusagen} von {a.plaetze}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.zurueckgezogenAm ? (
                      <Badge variant="outline">Zurückgezogen</Badge>
                    ) : a.zusagen >= a.plaetze ? (
                      // Besetzt, aber noch zurückziehbar: Ein Abend kann auch
                      // dann noch ausfallen, wenn alle Plätze weg sind.
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant="secondary">Besetzt</Badge>
                        <Zurueckziehen id={a.id} zusagen={a.zusagen} />
                      </div>
                    ) : (
                      <Zurueckziehen id={a.id} zusagen={a.zusagen} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Im Programm</h3>
          <p className="text-sm text-muted-foreground">
            Wer ausgeschlossen ist, bekommt keine Einladungen mehr und kann sich nicht neu anmelden.
            Bereits zugesagte Abende bleiben gültig.
          </p>
        </div>

        {teilnehmer.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch niemand angemeldet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teilnehmer.map((t) => (
                <TableRow key={t.customerId}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/kunden/${t.customerId}`} className="hover:underline">
                      {t.name}
                    </Link>
                    {t.ausgeschlossenAm ? (
                      <Badge variant="outline" className="ml-2">
                        Ausgeschlossen
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{ROLLE_NAME[t.rolle]}</TableCell>
                  <TableCell>{LEVEL_NAME[t.level as Kurslevel]}</TableCell>
                  <TableCell className="text-right">
                    <Ausschluss
                      customerId={t.customerId}
                      name={t.name}
                      ausgeschlossen={!!t.ausgeschlossenAm}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <AusschreibenDialog
        offen={dialogOffen}
        onOpenChange={setDialogOffen}
        kurse={kurse}
        vorbelegung={vorbelegung}
      />
    </div>
  );
}

function Zurueckziehen({ id, zusagen }: { id: string; zusagen: number }) {
  const [laeuft, setLaeuft] = useState(false);

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={laeuft}
      onClick={async () => {
        if (
          zusagen > 0 &&
          !window.confirm(
            `${zusagen} ${zusagen === 1 ? "Person hat" : "Personen haben"} bereits zugesagt. ` +
              "Die Zusage wird abgesagt und die Person benachrichtigt. Fortfahren?"
          )
        ) {
          return;
        }
        setLaeuft(true);
        const ergebnis = await ausschreibungZurueckziehen(id);
        setLaeuft(false);
        if ("error" in ergebnis) {
          toast.error(ergebnis.error);
          return;
        }
        toast.success("Ausschreibung zurückgezogen.");
      }}
    >
      {laeuft ? "…" : "Zurückziehen"}
    </Button>
  );
}

function Ausschluss({
  customerId,
  name,
  ausgeschlossen,
}: {
  customerId: string;
  name: string;
  ausgeschlossen: boolean;
}) {
  const [laeuft, setLaeuft] = useState(false);

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={laeuft}
      onClick={async () => {
        if (!ausgeschlossen && !window.confirm(`„${name}" aus dem Programm nehmen?`)) return;
        setLaeuft(true);
        const ergebnis = ausgeschlossen
          ? await gasttaenzerWiederZulassen(customerId)
          : await gasttaenzerAusschliessen(customerId);
        setLaeuft(false);
        if ("error" in ergebnis) {
          toast.error(ergebnis.error);
          return;
        }
        toast.success(ausgeschlossen ? "Wieder zugelassen." : "Aus dem Programm genommen.");
      }}
    >
      {laeuft ? "…" : ausgeschlossen ? "Wieder zulassen" : "Ausschließen"}
    </Button>
  );
}

function AusschreibenDialog({
  offen,
  onOpenChange,
  kurse,
  vorbelegung,
}: {
  offen: boolean;
  onOpenChange: (offen: boolean) => void;
  kurse: KursOption[];
  vorbelegung: { kursId: string; rolle: string; anzahl: number } | null;
}) {
  // Der Schlüssel setzt das Formular zurück, sobald sich die Vorbelegung
  // ändert — ohne Zustandsabgleich im Effekt, den der Linter zu Recht verbietet.
  return (
    <Dialog open={offen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gastplätze ausschreiben</DialogTitle>
          <DialogDescription>
            Passende Gasttänzer werden benachrichtigt und können bis Kursbeginn zusagen.
          </DialogDescription>
        </DialogHeader>
        <AusschreibenFormular
          key={`${vorbelegung?.kursId ?? "frei"}-${offen}`}
          kurse={kurse}
          vorbelegung={vorbelegung}
          onFertig={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AusschreibenFormular({
  kurse,
  vorbelegung,
  onFertig,
}: {
  kurse: KursOption[];
  vorbelegung: { kursId: string; rolle: string; anzahl: number } | null;
  onFertig: () => void;
}) {
  const [kursId, setKursId] = useState(vorbelegung?.kursId ?? kurse[0]?.id ?? "");
  const kurs = kurse.find((k) => k.id === kursId);
  const [termin, setTermin] = useState(kurs?.termine[0] ?? "");
  const [rolle, setRolle] = useState(vorbelegung?.rolle ?? "follower");
  const [anzahl, setAnzahl] = useState(String(vorbelegung?.anzahl ?? 1));
  const [mindeststufe, setMindeststufe] = useState<string>(eineStufeUeber(kurs?.level) ?? "");
  const [laeuft, setLaeuft] = useState(false);

  function kursWechseln(neu: string) {
    const gewaehlt = kurse.find((k) => k.id === neu);
    setKursId(neu);
    setTermin(gewaehlt?.termine[0] ?? "");
    setMindeststufe(eineStufeUeber(gewaehlt?.level) ?? "");
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    const formData = new FormData();
    formData.set("course_id", kursId);
    formData.set("occurrence_date", termin);
    formData.set("dance_role", rolle);
    formData.set("seats", anzahl);
    formData.set("min_level", mindeststufe);

    const ergebnis = await ausschreiben(formData);
    setLaeuft(false);
    if ("error" in ergebnis) {
      toast.error(ergebnis.error);
      return;
    }
    toast.success("Ausgeschrieben. Die passenden Gasttänzer sind benachrichtigt.");
    onFertig();
  }

  if (kurse.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein Kurs fragt nach der Rolle. Ohne Rollen gibt es nichts auszuschreiben — stell die
        Rollenabfrage beim Kurs ein, dann geht es.
      </p>
    );
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="kurs">Kurs</Label>
        <Select value={kursId} onValueChange={kursWechseln}>
          <SelectTrigger id="kurs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kurse.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="termin">Termin</Label>
        {kurs && kurs.termine.length > 0 ? (
          <Select value={termin} onValueChange={setTermin}>
            <SelectTrigger id="termin">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kurs.termine.map((t) => (
                <SelectItem key={t} value={t}>
                  {datumLang(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // Ferien, Pausen und ein beendeter Kurs fallen hier heraus — für einen
          // Abend, an dem nichts stattfindet, lässt sich nichts ausschreiben.
          <p className="text-sm text-muted-foreground">
            Für diesen Kurs stehen keine Termine an.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rolle">Gesucht</Label>
          <Select value={rolle} onValueChange={setRolle}>
            <SelectTrigger id="rolle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="follower">Follower</SelectItem>
              <SelectItem value="leader">Leader</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="anzahl">Plätze</Label>
          <Input
            id="anzahl"
            type="number"
            min={1}
            max={20}
            value={anzahl}
            onChange={(e) => setAnzahl(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="stufe">Mindeststufe</Label>
        <Select value={mindeststufe || "keine"} onValueChange={(w) => setMindeststufe(w === "keine" ? "" : w)}>
          <SelectTrigger id="stufe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keine">Keine Vorgabe</SelectItem>
            {LEVEL_REIHE.map((l) => (
              <SelectItem key={l} value={l}>
                ab {LEVEL_NAME[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Vorbelegt mit einer Stufe über dem Kurs. Bei Advanced und Open Level greift diese Regel nicht
          — dort entscheidest du.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFertig} disabled={laeuft}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={laeuft || !termin}>
          {laeuft ? "Wird ausgeschrieben …" : "Ausschreiben"}
        </Button>
      </DialogFooter>
    </form>
  );
}
