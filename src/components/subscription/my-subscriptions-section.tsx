"use client";

import { useState } from "react";
import {
  pauseSubscription,
  cancelSubscription,
  undoPendingSubscriptionChange,
  reactivateSubscription,
  switchSubscriptionCourse,
} from "@/lib/actions/subscription";
import { subscriptionStatusLabel, subscriptionStatusColor } from "@/lib/constants/subscription-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MySubscriptionRow = {
  id: string;
  name: string;
  courseId: string | null;
  courseName: string | null;
  price: number | null;
  status: string;
  pendingStatus: string | null;
  pendingEffectiveDate: string | null;
};

export type SubscriptionCourseOption = { id: string; name: string };

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pendingHint(row: MySubscriptionRow): string | null {
  if (!row.pendingStatus || !row.pendingEffectiveDate) return null;
  const date = formatDate(row.pendingEffectiveDate);
  return row.pendingStatus === "paused" ? `Wird pausiert ab ${date}` : `Wird gekündigt ab ${date}`;
}

export function MySubscriptionsSection({
  subscriptions: initialSubscriptions,
  courses,
}: {
  subscriptions: MySubscriptionRow[];
  courses: SubscriptionCourseOption[];
}) {
  const t = useTranslations("profile");
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [switchTarget, setSwitchTarget] = useState<MySubscriptionRow | null>(null);
  const [newCourseId, setNewCourseId] = useState("");

  async function run<T extends { error: string } | { success: true }>(
    subscriptionId: string,
    action: () => Promise<T>
  ): Promise<Exclude<T, { error: string }> | null> {
    setLoadingId(subscriptionId);
    setError(null);
    try {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return null;
      }
      return result as Exclude<T, { error: string }>;
    } finally {
      setLoadingId(null);
    }
  }

  async function handlePause(id: string) {
    const result = await run(id, () => pauseSubscription(id));
    if (!result) return;
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, pendingStatus: "paused", pendingEffectiveDate: result.pendingEffectiveDate } : s))
    );
  }

  async function handleCancel(id: string) {
    const result = await run(id, () => cancelSubscription(id));
    if (!result) return;
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, pendingStatus: "cancelled", pendingEffectiveDate: result.pendingEffectiveDate } : s))
    );
  }

  async function handleUndo(id: string) {
    const result = await run(id, () => undoPendingSubscriptionChange(id));
    if (!result) return;
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, pendingStatus: null, pendingEffectiveDate: null } : s)));
  }

  async function handleReactivate(id: string) {
    const result = await run(id, () => reactivateSubscription(id));
    if (!result) return;
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "active" } : s)));
  }

  async function handleSwitch() {
    if (!switchTarget || !newCourseId) return;
    const result = await run(switchTarget.id, () => switchSubscriptionCourse(switchTarget.id, newCourseId));
    if (!result) return;
    const course = courses.find((c) => c.id === newCourseId);
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === switchTarget.id ? { ...s, courseId: newCourseId, courseName: course?.name ?? s.courseName } : s
      )
    );
    setSwitchTarget(null);
    setNewCourseId("");
  }

  if (subscriptions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{t("noSubscription")}</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="space-y-2">
        {subscriptions.map((subscription) => {
          const hint = pendingHint(subscription);
          const isLoading = loadingId === subscription.id;
          const canPauseOrCancel = subscription.status === "active" && !subscription.pendingStatus;
          const canUndo = subscription.pendingStatus !== null;
          const canReactivate = subscription.status === "paused";
          const canSwitch = subscription.courseId !== null && subscription.status !== "cancelled";

          return (
            <li key={subscription.id} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{subscription.name}</span>
                <Badge style={{ backgroundColor: subscriptionStatusColor(subscription.status), color: "white" }}>
                  {subscriptionStatusLabel(subscription.status)}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {subscription.courseName && `${subscription.courseName} · `}
                {subscription.price !== null && formatPrice(subscription.price)}
              </p>
              {hint && <p className="text-sm font-medium text-amber-600">{hint}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {canPauseOrCancel && (
                  <>
                    <Button variant="outline" size="sm" disabled={isLoading} onClick={() => handlePause(subscription.id)}>
                      Pausieren
                    </Button>
                    <Button variant="outline" size="sm" disabled={isLoading} onClick={() => handleCancel(subscription.id)}>
                      Kündigen
                    </Button>
                  </>
                )}
                {canUndo && (
                  <Button variant="outline" size="sm" disabled={isLoading} onClick={() => handleUndo(subscription.id)}>
                    {t("undo")}
                  </Button>
                )}
                {canReactivate && (
                  <Button variant="outline" size="sm" disabled={isLoading} onClick={() => handleReactivate(subscription.id)}>
                    {t("reactivate")}
                  </Button>
                )}
                {canSwitch && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => {
                      setSwitchTarget(subscription);
                      setNewCourseId("");
                      setError(null);
                    }}
                  >
                    {t("rebook")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={switchTarget !== null} onOpenChange={(open) => !open && setSwitchTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Umbuchen</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Select value={newCourseId} onValueChange={setNewCourseId}>
              <SelectTrigger>
                <SelectValue placeholder={t("newCourse")} />
              </SelectTrigger>
              <SelectContent>
                {courses
                  .filter((c) => c.id !== switchTarget?.courseId)
                  .map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={!newCourseId || loadingId === switchTarget?.id} onClick={handleSwitch}>
              {t("confirmRebook")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
