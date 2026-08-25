"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBooking } from "@/lib/actions/booking";
import { checkCouponCode, type CouponCheckResult } from "@/lib/actions/coupons";
import { joinWaitlist } from "@/lib/actions/waitlist";
import {
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
import { PlanPriceTiles } from "@/components/booking/plan-price-tiles";
import { useLocale, useTranslations } from "next-intl";
import { formatPrice, type StudioPricing } from "@/lib/pricing";
import { TermsConsent } from "@/components/booking/terms-consent";
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

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export type BookingDialogCourse = {
  id: string;
  name: string;
  entryDates: string[];
  nextOccurrenceDates: string[];
  hasOpenRegularBooking: boolean;
  /** Fix zu PROJ-8: schon eingeschrieben — eine zweite Anmeldung hieße doppelter Einzug. */
  hasActiveSubscription: boolean;
  /** Eigener Preis dieses Kurses; `null` heißt „Standardpreis gilt" (PROJ-41). */
  price: number | null;
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
  pricing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: BookingDialogCourse;
  hasMandate: boolean;
  hasReferralSource: boolean;
  pricing: StudioPricing;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();
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
  const [termsAccepted, setTermsAccepted] = useState(false);
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

  const dropinPrice = wantsStudentPrice ? pricing.dropin.student : pricing.dropin.normal;

  const showWaitlistForm =
    tab === "regular" &&
    (course.isFull || roleImbalance) &&
    !course.isOnWaitlist &&
    !course.hasOpenRegularBooking &&
    !course.hasActiveSubscription &&
    hasMandate;

  // PROJ-30: Die Rollenwahl ist Pflicht, aber nur wo der Kurs sie überhaupt
  // abfragt — bei allen anderen gäbe es nichts zu wählen.
  const roleMissing = course.roleQueryEnabled && !danceRole;

  const canSubmit =
    !termsAccepted ||
    roleMissing ||
    (!!course.prerequisiteNote && !prerequisiteConfirmed) ||
    (!hasReferralSource && !referralSource)
      ? false
      : tab === "regular"
        ? hasMandate &&
          !course.hasOpenRegularBooking &&
          !course.hasActiveSubscription &&
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
        formData.set("terms_accepted", String(termsAccepted));

        const result = await joinWaitlist(formData);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        if ("needsMandate" in result) {
          setError(t("errMandate"));
          return;
        }

        toast.success(t("toastWaitlist"));
        onOpenChange(false);
        router.refresh();
        return;
      }

      const formData = new FormData();
      formData.set("course_id", course.id);
      formData.set("type", tab);
      formData.set("referral_source", referralSource);
      formData.set("prerequisite_confirmed", String(prerequisiteConfirmed));
      formData.set("terms_accepted", String(termsAccepted));

      if (tab === "regular") {
        formData.set("chosen_date", regularDate);
        formData.set("desired_plan", desiredPlan);
        formData.set("note", note);
        formData.set("dance_role", danceRole);
        formData.set("coupon_code", couponCode.trim());
        formData.set("wants_student_price", String(wantsStudentPrice));
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
        setError(t("errMandate"));
        return;
      }
      if ("full" in result) {
        setError(t("errFull"));
        router.refresh();
        return;
      }
      if ("roleImbalance" in result) {
        setRoleImbalance(true);
        setError(
          t("errRole")
        );
        return;
      }

      toast.success(
        result.booking.status === "confirmed" ? t("toastConfirmed") : t("toastReceived")
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
              {t("tabRegular")}
            </TabsTrigger>
            <TabsTrigger value="trial" className="flex-1">
              {t("tabTrial")}
            </TabsTrigger>
            <TabsTrigger value="dropin" className="flex-1">
              {t("tabDropin")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regular" className="space-y-3 pt-2">
            {course.hasActiveSubscription ? (
              <Alert>
                <AlertDescription>
                  {t("alreadyEnrolled")}
                </AlertDescription>
              </Alert>
            ) : course.hasOpenRegularBooking ? (
              <Alert>
                <AlertDescription>{t("alreadyBooked")}</AlertDescription>
              </Alert>
            ) : course.isOnWaitlist ? (
              <Alert>
                <AlertDescription>
                  {t("alreadyOnWaitlist")}
                </AlertDescription>
              </Alert>
            ) : !hasMandate ? (
              <Alert>
                <AlertDescription>
                  {t("needsMandate")}{" "}
                  <Link href="/profil" className="underline">
                    {t("addMandate")}
                  </Link>
                </AlertDescription>
              </Alert>
            ) : course.entryDates.length === 0 ? (
              <Alert>
                <AlertDescription>{t("noEntryDates")}</AlertDescription>
              </Alert>
            ) : (
              <>
                {course.isFull && (
                  <Alert>
                    <AlertDescription>
                      {t("courseFull")}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1">
                  <Label>{t("entryDate")}</Label>
                  <Select value={regularDate} onValueChange={setRegularDate}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("choose")} />
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
                  <Label>{t("planType")}</Label>
                  <PlanPriceTiles
                    pricing={pricing}
                    coursePrice={course.price}
                    student={wantsStudentPrice}
                    value={desiredPlan}
                    onChange={setDesiredPlan}
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="wants-student-price-regular"
                      checked={wantsStudentPrice}
                      onCheckedChange={(checked) => setWantsStudentPrice(checked === true)}
                    />
                    <Label htmlFor="wants-student-price-regular" className="font-normal">
                      {t("studentPrice")}
                    </Label>
                  </div>
                </div>
                {course.roleQueryEnabled && (
                  <div className="space-y-2">
                    <Label>{t("danceRole")}</Label>
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
                      <Label htmlFor="booking-note">{t("note")}</Label>
                      <Textarea id="booking-note" value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="booking-coupon">{t("couponCode")}</Label>
                      <Input
                        id="booking-coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder={t("couponPlaceholder")}
                      />
                      {couponChecking ? (
                        <p className="text-xs text-muted-foreground">{t("couponChecking")}</p>
                      ) : couponStatus?.valid ? (
                        <p className="text-xs text-emerald-600">
                          Gutschein gültig:{" "}
                          {couponStatus.discountType === "percent"
                            ? `${couponStatus.discountAmount}% Rabatt`
                            : `${formatPrice(couponStatus.discountAmount)} Rabatt`}
                        </p>
                      ) : couponStatus?.rateLimited ? (
                        <p className="text-xs text-destructive">
                          Zu viele Code-Versuche. Bitte warte ein paar Minuten. Du kannst trotzdem ohne Gutschein
                          buchen.
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
                <AlertDescription>{t("noWeeklySlot")}</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1">
                <Label>{t("date")}</Label>
                <Select value={trialDate} onValueChange={setTrialDate}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {course.nextOccurrenceDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        {formatDate(date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("trialFree")}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="dropin" className="space-y-3 pt-2">
            {course.nextOccurrenceDates.length === 0 ? (
              <Alert>
                <AlertDescription>{t("noWeeklySlot")}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Termin</Label>
                  <Select value={dropinDate} onValueChange={setDropinDate}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("choose")} />
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
                    {t("studentPrice")}
                  </Label>
                </div>
                <p className="text-sm font-medium">{t("dropinOnSite", { price: formatPrice(dropinPrice, locale) })}</p>
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
                {t("prerequisiteConfirm")}
              </Label>
            </div>
          </div>
        )}

        {!hasReferralSource && (
          <div className="space-y-1 pt-2 border-t">
            <Label>{t("referralQuestion")}</Label>
            <Select value={referralSource} onValueChange={setReferralSource}>
              <SelectTrigger>
                <SelectValue placeholder={t("choose")} />
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

        <TermsConsent checked={termsAccepted} onCheckedChange={setTermsAccepted} id="terms-accepted-booking" />

        <DialogFooter>
          <Button disabled={loading || !canSubmit} onClick={handleSubmit}>
            {loading
              ? t("submitting")
              : showWaitlistForm
                ? // Ein Wartelisten-Eintrag verpflichtet zu nichts — hier wäre
                  // "verbindlich buchen" schlicht falsch.
                  t("submitWaitlist")
                : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
