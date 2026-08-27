"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { createCoupon, toggleCouponActive } from "@/lib/actions/admin/coupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { heuteInWien } from "@/lib/constants/zeitzone";

export type CouponRow = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountAmount: number;
  maxRedemptions: number;
  redemptionCount: number;
  expiresAt: string | null;
  active: boolean;
};

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDiscount(type: "percent" | "fixed", amount: number): string {
  return type === "percent" ? `${amount}%` : formatPrice(amount);
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("de-AT");
}

// Excludes easily-confused characters (0/O, 1/I) since these codes get read
// aloud, written on flyers and re-typed by customers.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Unguessable code for personal one-off vouchers — rate limiting alone can't
 *  protect a memorable code like "SOMMER25" (see PROJ-15 QA BUG-1). */
function generateRandomCode(): string {
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function CouponManager({ coupons: initialCoupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initialCoupons);

  // initialCoupons only seeds state on mount — a server-driven refresh after
  // create/toggle would otherwise be ignored while this stays mounted.
  useEffect(() => {
    setCoupons(initialCoupons);
  }, [initialCoupons]);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountAmount, setDiscountAmount] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const canSubmit = code.trim().length > 0 && discountAmount.trim().length > 0 && maxRedemptions.trim().length > 0;

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("code", code.trim());
      formData.set("discount_type", discountType);
      formData.set("discount_amount", discountAmount);
      formData.set("max_redemptions", maxRedemptions);
      formData.set("expires_at", expiresAt);

      const result = await createCoupon(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Gutschein angelegt.");
      setCode("");
      setDiscountAmount("");
      setMaxRedemptions("1");
      setExpiresAt("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(couponId: string, active: boolean) {
    setTogglingId(couponId);
    setError(null);
    try {
      const result = await toggleCouponActive(couponId, active);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCoupons((prev) => prev.map((c) => (c.id === couponId ? { ...c, active } : c)));
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border p-4 space-y-4">
        <p className="text-sm font-medium">Neuen Gutschein anlegen</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="coupon-code">Code</Label>
            <div className="flex gap-2">
              <Input
                id="coupon-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="z.B. WILLKOMMEN20"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Zufälligen Code erzeugen (für persönliche Gutscheine)"
                aria-label="Zufälligen Code erzeugen"
                onClick={() => setCode(generateRandomCode())}
              >
                <Shuffle className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="coupon-type">Rabatt-Typ</Label>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
              <SelectTrigger id="coupon-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Prozent</SelectItem>
                <SelectItem value="fixed">Festbetrag</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="coupon-amount">{discountType === "percent" ? "Rabatt (%)" : "Rabatt (€)"}</Label>
            <Input
              id="coupon-amount"
              type="number"
              step={discountType === "percent" ? "1" : "0.01"}
              min="0"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="coupon-max">Max. Einlösungen</Label>
            <Input
              id="coupon-max"
              type="number"
              step="1"
              min="1"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="coupon-expires">Gültig bis (optional)</Label>
            <Input
              id="coupon-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <Button type="button" disabled={!canSubmit || saving} onClick={handleCreate}>
          {saving ? "Wird angelegt…" : "Gutschein anlegen"}
        </Button>
      </div>

      {coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Gutscheine angelegt.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Rabatt</TableHead>
              <TableHead>Eingelöst</TableHead>
              <TableHead>Gültig bis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktiv</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => {
              const exhausted = coupon.redemptionCount >= coupon.maxRedemptions;
              const expired = !!coupon.expiresAt && coupon.expiresAt < heuteInWien();
              return (
                <TableRow key={coupon.id}>
                  <TableCell className="font-medium">{coupon.code}</TableCell>
                  <TableCell>{formatDiscount(coupon.discountType, coupon.discountAmount)}</TableCell>
                  <TableCell>
                    {coupon.redemptionCount} von {coupon.maxRedemptions}
                  </TableCell>
                  <TableCell>{coupon.expiresAt ? formatDate(coupon.expiresAt) : "—"}</TableCell>
                  <TableCell>
                    {!coupon.active ? (
                      <Badge variant="outline">Inaktiv</Badge>
                    ) : expired ? (
                      <Badge variant="outline">Abgelaufen</Badge>
                    ) : exhausted ? (
                      <Badge variant="outline">Aufgebraucht</Badge>
                    ) : (
                      <Badge>Aktiv</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={coupon.active}
                      disabled={togglingId === coupon.id}
                      onCheckedChange={(checked) => handleToggle(coupon.id, checked)}
                      aria-label={`Gutschein ${coupon.code} aktivieren oder deaktivieren`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
