"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import type { EinmalGast } from "@/lib/teacher/einmal-gaeste";
import type { DanceRole } from "@/components/teacher/attendance-matrix";
import { danceRoleLabel } from "@/lib/constants/booking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Probestunden, Drop-Ins und Gäste eines einzelnen Termins (PROJ-74).
 *
 * Bewusst eine eigene Tabelle und nicht ein Teil der Matrix: Diese Leute haben
 * genau einen Termin. In der Vier-Wochen-Matrix wären drei von vier Spalten
 * leer, und die Lehrkraft müsste jede Zelle aufklappen, um zu sehen, wer neu
 * ist.
 *
 * Die Komponente hält keinen eigenen Zustand. Häkchen, Fehler und Speichern
 * liegen bei der Matrix — sonst gäbe es zwei Wahrheiten über ein Häkchen.
 */
export function EinmalGaesteListe({
  datum,
  gaeste,
  isAdmin,
  roleQueryEnabled,
  roleByCustomer,
  savingKey,
  onMark,
}: {
  datum: string;
  gaeste: EinmalGast[];
  isAdmin: boolean;
  roleQueryEnabled: boolean;
  roleByCustomer: Record<string, DanceRole>;
  savingKey: string | null;
  onMark: (customerId: string, status: "present" | "absent") => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg font-semibold">
        Probestunden, Drop-Ins &amp; Gäste
        <span className="ml-2 text-sm font-normal text-muted-foreground">{formatDatum(datum)}</span>
      </h2>

      {gaeste.length === 0 ? (
        // Eine leere Fläche ließe offen, ob niemand gebucht hat oder etwas
        // kaputt ist.
        <p className="text-sm text-muted-foreground py-4">
          Für diesen Termin ist niemand als Probestunde, Drop-In oder Gast gebucht.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Name</TableHead>
                <TableHead>Art</TableHead>
                {roleQueryEnabled && <TableHead>Rolle</TableHead>}
                <TableHead className="text-right">Anwesenheit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gaeste.map((gast) => {
                const key = `${gast.customerId}:${datum}`;
                const rolle = roleByCustomer[gast.customerId];
                return (
                  <TableRow key={gast.customerId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <Link href={`/admin/kunden/${gast.customerId}`} className="hover:underline">
                            {gast.fullName}
                          </Link>
                        ) : (
                          gast.fullName
                        )}
                        {gast.selfCheckedIn && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-blue-500"
                            title="Self-Check-In"
                            aria-label="Hat sich selbst eingecheckt"
                            role="img"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{gast.art}</Badge>
                    </TableCell>
                    {roleQueryEnabled && (
                      <TableCell className="text-sm text-muted-foreground">
                        {rolle ? danceRoleLabel(rolle) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant={gast.status === "present" ? "default" : "outline"}
                          disabled={savingKey === key}
                          onClick={() => onMark(gast.customerId, "present")}
                          aria-label={`${gast.fullName} als anwesend markieren`}
                        >
                          <Check className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Anwesend</span>
                        </Button>
                        <Button
                          size="sm"
                          variant={gast.status === "absent" ? "default" : "outline"}
                          disabled={savingKey === key}
                          onClick={() => onMark(gast.customerId, "absent")}
                          aria-label={`${gast.fullName} als abwesend markieren`}
                        >
                          <X className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Abwesend</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
