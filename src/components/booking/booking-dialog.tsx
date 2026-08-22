"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBooking } from "@/lib/actions/booking";
import { checkCouponCode, type CouponCheckResult } from "@/lib/actions/coupons";
import { joinWaitlist } from "@/lib/actions/waitlist";
import {
  desiredPlanOptions,
  referralSourceOptions,
  danceRoleOptions,
  type DesiredPlan,
  type DanceRole,
} from "@/lib/constants/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export type BookingDialogCourse = {
  id: string;
  name: string;
  entryDates: string[];
  nextOccurrenceDates: string[];
  hasOpenRegularBooking: boolean;
  isFull: boolean;
  isOnWaitlist: boolean;
  prerequisiteNote: string | null;
  roleQueryEnabled: boolean;
};

export function BookingDialog({
  open,
  onOpenChange,
  course,
  hasMandate,
  hasReferralSource,
  dropinPricing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: BookingDialogCourse;
  hasMandate: boolean;
  hasReferralSource: boolean;
  dropinPricing: { normal: number; student: number };
}) {
  const router = useRouter();
  const defaultTab =
    course.entryDates.length > 0 ? "regular" : course.nextOccurrenceDates.length > 0 ? "trial" : "dropin";
  const [tab, setTab] = useState(defaultTab);
  const [regularDate, setRegularDate] = useState("");
  const [desiredPlan, setDesiredPlan] = useState<DesiredPlan | "">("");
  const [note, setNote] = useState("");
  const [trialDate, setTrialDate] = useState("");
  const [dropinDate, setDropinDate] = useState("");
  const [wantsStudentPrice, setWantsStudentPrice] = useState(false);
  const [referralSource, setReferralSource] = useState("");
  const [prerequisiteConfirmed, setPrerequisiteConfirmed] = useState(false);
  const [danceRole, setDanceRole] = useState<DanceRole | "">("");
  const [roleImbalance, setRoleImbalance] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState<CouponCheckResult | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounced validity hint for the coupon field (PROJ-15): purely advisory —
  // an invalid code never blocks submitting, it just shows an inline error so
  // the customer can fix a typo before sending the request.
  useEffect(() => {
    const trimmed = couponCode.trim();
    if (!trimmed) {
      setCouponStatus(null);
      setCouponChecking(false);
      return;
    }
    setCouponChecking(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkCouponCode(trimmed);
      if (cancelled) return;
      setCouponStatus(result);
      setCouponChecking(false);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [couponCode]);

  const dropinPrice = wantsStudentPrice ? dropinPricing.student : dropinPricing.normal;

  const showWaitlistForm =
    tab === "regular" &&
    (course.isFull || roleImbalance) &&
    !course.isOnWaitlist &&
    !course.hasOpenRegularBooking &&
    hasMandate;

  const canSubmit =
    (!!course.prerequisiteNote && !prerequisiteConfirmed) || (!hasReferralSource && !referralSource)
      ? false
      : tab === "regular"
        ? hasMandate &&
          !course.hasOpenRegularBooking &&
          !course.isOnWaitlist &&
          !!regularDate &&
          !!desiredPlan
        : tab === "trial"
          ? !!trialDate
          : !!dropinDate;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      if (showWaitlistForm) {
        const formData = new FormData();
        formData.set("course_id", course.id);
        formData.set("chosen_date", regularDate);
        formData.set("desired_plan", desiredPlan);
        formData.set("dance_role", danceRole);

        const result = await joinWaitlist(formData);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        if ("needsMandate" in result) {
          setError("Bitte hinterlege zuerst ein SEPA-Mandat auf deinem Profil.");
          return;
        }

        toast.success("Du wurdest auf die Warteliste eingetragen.");
        onOpenChange(false);
        router.refresh();
        return;
      }

      const formData = new FormData();
      formData.set("course_id", course.id);
      formData.set("type", tab);
      formData.set("referral_source", referralSource);
      formData.set("prerequisite_confirmed", String(prerequisiteConfirmed));

      if (tab === "regular") {
        formData.set("chosen_date", regularDate);
        formData.set("desired_plan", desiredPlan);
        formData.set("note", note);
        formData.set("dance_role", danceRole);
        formData.set("coupon_code", couponCode.trim());
      } else if (tab === "trial") {
        formData.set("chosen_date", trialDate);
      } else {
        formData.set("chosen_date", dropinDate);
        formData.set("wants_student_price", String(wantsStudentPrice));
      }

      const result = await createBooking(formData);

      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("needsMandate" in result) {
        setError("Bitte hinterlege zuerst ein SEPA-Mandat auf deinem Profil.");
        return;
      }
      if ("full" in result) {
        setError("Dieser Kurs ist mittlerweile voll. Bitte trage dich auf die Warteliste ein.");
        router.refresh();
        return;
      }
      if ("roleImbalance" in result) {
        setRoleImbalance(true);
        setError(
          "Diese Rolle ist für diesen Kurs aktuell nicht verfügbar. Bitte trage dich auf die Warteliste ein."
        );
        return;
      }

      toast.success(
        result.booking.status === "confirmed" ? "Buchung bestätigt!" : "Anfrage gesendet — wir melden uns bald."
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course.name}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="regular" className="flex-1">
              Anmeldung
            </TabsTrigger>
            <TabsTrigger value="trial" className="flex-1">
              Probestunde
            </TabsTrigger>
            <TabsTrigger value="dropin" className="flex-1">
              Drop-in
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regular" className="space-y-3 pt-2">
            {course.hasOpenRegularBooking ? (
              <Alert>
                <AlertDescription>Du hast bereits eine offene Anfrage für diesen Kurs.</AlertDescription>
              </Alert>
            ) : course.isOnWaitlist ? (
              <Alert>
                <AlertDescription>
                  Du stehst bereits auf der Warteliste für diesen Kurs. Du findest deinen Platz auf der
                  Warteliste in deinem Profil.
                </AlertDescription>
              </Alert>
            ) : !hasMandate ? (
              <Alert>
                <AlertDescription>
                  Für eine Anmeldung brauchst du zuerst ein SEPA-Mandat.{" "}
                  <Link href="/profil" className="underline">
                    Jetzt hinterlegen
                  </Link>
                </AlertDescription>
              </Alert>
            ) : course.entryDates.length === 0 ? (
              <Alert>
                <AlertDescription>Aktuell keine Einstiegstermine verfügbar.</AlertDescription>
              </Alert>
            ) : (
              <>
                {course.isFull && (
                  <Alert>
                    <AlertDescription>
                      Dieser Kurs ist aktuell voll. Trage dich auf die Warteliste ein — du wirst automatisch
                      benachrichtigt, sobald ein Platz frei wird.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1">
                  <Label>Einstiegstermin</Label>
                  <Select value={regularDate} onValueChange={setRegularDate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {course.entryDates.map((date) => (
                        <SelectItem key={date} value={date}>
                          {formatDate(date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Abo-Art</Label>
                  <RadioGroup value={desiredPlan} onValueChange={(v) => setDesiredPlan(v as DesiredPlan)}>
                    {desiredPlanOptions.map((option) => (
                      <div key={option.value} className="flex items-center gap-2">
                        <RadioGroupItem value={option.value} id={`plan-${option.value}`} />
                        <Label htmlFor={`plan-${option.value}`} className="font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                {course.roleQueryEnabled && (
                  <div className="space-y-2">
                    <Label>Ich tanze als (optional)</Label>
                    <RadioGroup
                      value={danceRole}
                      onValueChange={(v) => {
                        setDanceRole(v as DanceRole);
                        setRoleImbalance(false);
                      }}
                    >
                      {danceRoleOptions.map((option) => (
                        <div key={option.value} className="flex items-center gap-2">
                          <RadioGroupItem value={option.value} id={`role-${option.value}`} />
                          <Label htmlFor={`role-${option.value}`} className="font-normal">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                {!course.isFull && !roleImbalance && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="booking-note">Notiz (optional)</Label>
                      <Textarea id="booking-note" value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="booking-coupon">Gutscheincode (optional)</Label>
                      <Input
                        id="booking-coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="z.B. WILLKOMMEN20"
                      />
                      {couponChecking ? (
                        <p className="text-xs text-muted-foreground">Code wird geprüft…</p>
                      ) : couponStatus?.valid ? (
                        <p className="text-xs text-emerald-600">
                          Gutschein gültig:{" "}
                          {couponStatus.discountType === "percent"
                            ? `${couponStatus.discountAmount}% Rabatt`
                            : `${formatPrice(couponStatus.discountAmount)} Rabatt`}
                        </p>
                      ) : couponStatus ? (
                        <p className="text-xs text-destructive">
                          Dieser Code ist nicht gültig. Du kannst trotzdem ohne Gutschein buchen.
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="trial" className="space-y-3 pt-2">
            {course.nextOccurrenceDates.length === 0 ? (
              <Alert>
                <AlertDescription>Kein Wochentermin hinterlegt.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1">
                <Label>Termin</Label>
                <Select value={trialDate} onValueChange={setTrialDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {course.nextOccurrenceDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        {formatDate(date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Kostenlos, wird sofort bestätigt.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dropin" className="space-y-3 pt-2">
            {course.nextOccurrenceDates.length === 0 ? (
              <Alert>
                <AlertDescription>Kein Wochentermin hinterlegt.</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Termin</Label>
                  <Select value={dropinDate} onValueChange={setDropinDate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {course.nextOccurrenceDates.map((date) => (
                        <SelectItem key={date} value={date}>
                          {formatDate(date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="wants-student-price"
                    checked={wantsStudentPrice}
                    onCheckedChange={(checked) => setWantsStudentPrice(checked === true)}
                  />
                  <Label htmlFor="wants-student-price" className="font-normal">
                    Ich bin Student(in)
                  </Label>
                </div>
                <p className="text-sm font-medium">{formatPrice(dropinPrice)} — bar/SumUp vor Ort</p>
              </>
            )}
          </TabsContent>
        </Tabs>

        {course.prerequisiteNote && (
          <div className="space-y-2 pt-2 border-t">
            <Alert>
              <AlertDescription>{course.prerequisiteNote}</AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Checkbox
                id="prerequisite-confirmed"
                checked={prerequisiteConfirmed}
                onCheckedChange={(checked) => setPrerequisiteConfirmed(checked === true)}
              />
              <Label htmlFor="prerequisite-confirmed" className="font-normal">
                Ich bestätige, dass ich die genannte Voraussetzung erfülle.
              </Label>
            </div>
          </div>
        )}

        {!hasReferralSource && (
          <div className="space-y-1 pt-2 border-t">
            <Label>Wie haben Sie von uns erfahren?</Label>
            <Select value={referralSource} onValueChange={setReferralSource}>
              <SelectTrigger>
                <SelectValue placeholder="Bitte wählen" />
              </SelectTrigger>
              <SelectContent>
                {referralSourceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button disabled={loading || !canSubmit} onClick={handleSubmit}>
            {loading ? "Wird gesendet…" : showWaitlistForm ? "Auf Warteliste eintragen" : "Absenden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
