"use client";

import { useState } from "react";
import { toast } from "sonner";
import { leaveWaitlist } from "@/lib/actions/waitlist";
import { desiredPlanLabel } from "@/lib/constants/booking";
import { Button } from "@/components/ui/button";

export type MyWaitlistRow = {
  id: string;
  courseId: string;
  courseName: string;
  desiredPlan: string;
  chosenDate: string;
  position: number;
};

export function MyWaitlistSection({ entries: initialEntries }: { entries: MyWaitlistRow[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleLeave(id: string) {
    setLoadingId(id);
    try {
      const result = await leaveWaitlist(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Von der Warteliste ausgetragen.");
    } finally {
      setLoadingId(null);
    }
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Du stehst auf keiner Warteliste.</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-md border p-3 space-y-1">
          <p className="font-medium">{entry.courseName}</p>
          <p className="text-sm text-muted-foreground">
            Position {entry.position} · {desiredPlanLabel(entry.desiredPlan)} · ab{" "}
            {new Date(entry.chosenDate).toLocaleDateString("de-AT")}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={loadingId === entry.id}
            onClick={() => handleLeave(entry.id)}
          >
            Von der Warteliste austragen
          </Button>
        </li>
      ))}
    </ul>
  );
}
