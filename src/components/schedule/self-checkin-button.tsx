"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { selfToggleAttendance } from "@/lib/actions/self-checkin";
import { Button } from "@/components/ui/button";

export function SelfCheckinButton({
  courseId,
  opensAtIso,
  endsAtIso,
  initialCheckedIn,
}: {
  courseId: string;
  opensAtIso: string;
  endsAtIso: string;
  initialCheckedIn: boolean;
}) {
  const t = useTranslations("dashboard.checkin");
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [loading, setLoading] = useState(false);

  const now = Date.now();
  const opensAt = new Date(opensAtIso).getTime();
  const endsAt = new Date(endsAtIso).getTime();

  if (now < opensAt) {
    return null;
  }

  const canUndo = now < endsAt;

  async function handleClick() {
    if (checkedIn && !canUndo) return;
    setLoading(true);
    try {
      const result = await selfToggleAttendance(courseId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCheckedIn(result.status === "present");
      toast.success(result.status === "present" ? t("successIn") : t("successOut"));
    } finally {
      setLoading(false);
    }
  }

  if (checkedIn && !canUndo) {
    return (
      <Button size="sm" variant="secondary" disabled className="w-full">
        ✓ {t("done")}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant={checkedIn ? "secondary" : "default"}
      disabled={loading}
      onClick={handleClick}
      className="w-full"
    >
      {checkedIn ? `✓ ${t("done")}` : t("action")}
    </Button>
  );
}
