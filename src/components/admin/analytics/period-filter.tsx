"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PeriodFilter({
  from,
  to,
  isCustom,
}: {
  from: string;
  to: string;
  isCustom: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [error, setError] = useState<string | null>(null);

  function applyRange() {
    if (draftFrom > draftTo) {
      setError("Das Enddatum muss nach dem Startdatum liegen.");
      return;
    }
    setError(null);
    router.push(`${pathname}?from=${draftFrom}&to=${draftTo}`);
  }

  function resetToCurrentMonth() {
    setError(null);
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="period-from" className="text-xs">
            Von
          </Label>
          <Input
            id="period-from"
            type="date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="period-to" className="text-xs">
            Bis
          </Label>
          <Input
            id="period-to"
            type="date"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button type="button" size="sm" onClick={applyRange}>
          Anwenden
        </Button>
        {isCustom && (
          <Button type="button" size="sm" variant="outline" onClick={resetToCurrentMonth}>
            Laufender Monat
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
