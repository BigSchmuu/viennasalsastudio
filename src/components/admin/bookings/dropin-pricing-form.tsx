"use client";

import { useState } from "react";
import { updateDropinPricing } from "@/lib/actions/admin/dropin-pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DropinPricingForm({
  normalPrice: initialNormal,
  studentPrice: initialStudent,
}: {
  normalPrice: number;
  studentPrice: number;
}) {
  const [normalPrice, setNormalPrice] = useState(String(initialNormal));
  const [studentPrice, setStudentPrice] = useState(String(initialStudent));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set("normal_price", normalPrice);
      formData.set("student_price", studentPrice);
      const result = await updateDropinPricing(formData);
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
    <div className="rounded-md border p-4 space-y-3">
      <p className="text-sm font-medium">Drop-in-Preise</p>
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="normal-price">Normalpreis (€)</Label>
          <Input
            id="normal-price"
            type="number"
            step="0.01"
            min="0"
            value={normalPrice}
            onChange={(e) => setNormalPrice(e.target.value)}
            className="w-32"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="student-price">Studierendenpreis (€)</Label>
          <Input
            id="student-price"
            type="number"
            step="0.01"
            min="0"
            value={studentPrice}
            onChange={(e) => setStudentPrice(e.target.value)}
            className="w-32"
          />
        </div>
        <Button type="button" size="sm" disabled={loading} onClick={handleSave}>
          {loading ? "Wird gespeichert…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
