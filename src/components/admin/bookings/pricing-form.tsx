"use client";

import { useState } from "react";
import { updatePricing } from "@/lib/actions/admin/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { StudioPricing } from "@/lib/pricing";

/** Ein Preisfeld — leerer String heißt „nicht gepflegt", nicht „0 €". */
function PriceField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-32"
      />
    </div>
  );
}

const toField = (value: number | null) => (value === null ? "" : String(value));

/**
 * Die Preisliste des Studios (PROJ-41).
 *
 * Alle Preise stehen an einer Stelle — ein zweiter Ort wäre eine weitere
 * Stelle zum Vergessen. Abo- und Flatrate-Preise dürfen leer bleiben; leer
 * heißt „noch nicht gepflegt" und führt im Buchungsdialog zu einem Hinweis
 * statt zu einer Kachel mit 0,00 €.
 */
export function PricingForm({ pricing }: { pricing: StudioPricing }) {
  const [dropinNormal, setDropinNormal] = useState(String(pricing.dropin.normal));
  const [dropinStudent, setDropinStudent] = useState(String(pricing.dropin.student));
  const [courseNormal, setCourseNormal] = useState(toField(pricing.course.normal));
  const [courseStudent, setCourseStudent] = useState(toField(pricing.course.student));
  const [flatrateNormal, setFlatrateNormal] = useState(toField(pricing.flatrate.normal));
  const [flatrateStudent, setFlatrateStudent] = useState(toField(pricing.flatrate.student));
  const [rewardReferrer, setRewardReferrer] = useState(String(pricing.referral.referrer));
  const [rewardReferee, setRewardReferee] = useState(String(pricing.referral.referee));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set("normal_price", dropinNormal);
      formData.set("student_price", dropinStudent);
      formData.set("course_price", courseNormal);
      formData.set("course_student_price", courseStudent);
      formData.set("flatrate_price", flatrateNormal);
      formData.set("flatrate_student_price", flatrateStudent);
      formData.set("referral_reward_referrer", rewardReferrer);
      formData.set("referral_reward_referee", rewardReferee);
      const result = await updatePricing(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div>
        <p className="text-sm font-medium">Preise</p>
        <p className="text-xs text-muted-foreground">
          Der Kursabo-Preis gilt für alle Kurse, bei denen kein eigener Preis eingetragen ist.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Preise gespeichert.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Drop-in</p>
        <div className="flex flex-wrap items-end gap-3">
          <PriceField id="normal-price" label="Normalpreis (€)" value={dropinNormal} onChange={setDropinNormal} />
          <PriceField
            id="student-price"
            label="Studierendenpreis (€)"
            value={dropinStudent}
            onChange={setDropinStudent}
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kursabo (pro Monat)</p>
        <div className="flex flex-wrap items-end gap-3">
          <PriceField
            id="course-price"
            label="Normalpreis (€)"
            value={courseNormal}
            onChange={setCourseNormal}
            placeholder="65"
          />
          <PriceField
            id="course-student-price"
            label="Studierendenpreis (€)"
            value={courseStudent}
            onChange={setCourseStudent}
            placeholder="45"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flatrate (pro Monat)</p>
        <div className="flex flex-wrap items-end gap-3">
          <PriceField
            id="flatrate-price"
            label="Normalpreis (€)"
            value={flatrateNormal}
            onChange={setFlatrateNormal}
            placeholder="145"
          />
          <PriceField
            id="flatrate-student-price"
            label="Studierendenpreis (€)"
            value={flatrateStudent}
            onChange={setFlatrateStudent}
            placeholder="100"
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empfehlungsguthaben</p>
        <div className="flex flex-wrap items-end gap-3">
          <PriceField
            id="referral-reward-referrer"
            label="Für den Werbenden (€)"
            value={rewardReferrer}
            onChange={setRewardReferrer}
          />
          <PriceField
            id="referral-reward-referee"
            label="Für den Geworbenen (€)"
            value={rewardReferee}
            onChange={setRewardReferee}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Wird gutgeschrieben, sobald die erste Lastschrift des Geworbenen durchgegangen ist. Beide auf 0 gesetzt
          schaltet das Empfehlungsprogramm ab. Bereits vergebenes Guthaben bleibt unverändert.
        </p>
      </div>

      <Button type="button" size="sm" disabled={loading} onClick={handleSave}>
        {loading ? "Wird gespeichert…" : "Speichern"}
      </Button>
    </div>
  );
}
