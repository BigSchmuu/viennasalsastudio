"use client";

import { useState } from "react";
import { updateInvoiceSettings } from "@/lib/actions/admin/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function InvoiceSettingsForm({
  companyName: initialCompanyName,
  address: initialAddress,
  uidNumber: initialUidNumber,
  vatRate: initialVatRate,
  bounceFeeDefault: initialBounceFeeDefault,
}: {
  companyName: string;
  address: string;
  uidNumber: string;
  vatRate: number;
  bounceFeeDefault: number;
}) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [address, setAddress] = useState(initialAddress);
  const [uidNumber, setUidNumber] = useState(initialUidNumber);
  const [vatRate, setVatRate] = useState(String(initialVatRate));
  const [bounceFeeDefault, setBounceFeeDefault] = useState(String(initialBounceFeeDefault));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set("company_name", companyName);
      formData.set("address", address);
      formData.set("uid_number", uidNumber);
      formData.set("vat_rate", vatRate);
      formData.set("bounce_fee_default", bounceFeeDefault);
      const result = await updateInvoiceSettings(formData);
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
    <div className="rounded-md border p-4 space-y-3 max-w-lg">
      <p className="text-sm font-medium">Rechnungseinstellungen</p>
      <p className="text-xs text-muted-foreground">
        Diese Angaben erscheinen auf jeder neuen Rechnung. Der USt-Satz wird pro Rechnung eingefroren — eine
        Änderung hier wirkt sich nur auf zukünftig erstellte Rechnungen aus.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert>
          <AlertDescription>Einstellungen gespeichert.</AlertDescription>
        </Alert>
      )}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="company-name">Firmenname</Label>
          <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="address">Adresse</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="uid-number">UID-Nummer</Label>
          <Input id="uid-number" value={uidNumber} onChange={(e) => setUidNumber(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vat-rate">USt-Satz (%)</Label>
          <Input
            id="vat-rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            className="w-32"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bounce-fee-default">Rücklastschrift-Gebühr (€)</Label>
          <Input
            id="bounce-fee-default"
            type="number"
            step="0.01"
            min="0"
            value={bounceFeeDefault}
            onChange={(e) => setBounceFeeDefault(e.target.value)}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Wird bei neuen offenen Posten vorgeschlagen und lässt sich dort einzeln überschreiben. Eine
            Änderung hier wirkt sich nicht auf bereits erfasste Posten aus.
          </p>
        </div>
        <Button type="button" size="sm" disabled={loading} onClick={handleSave}>
          {loading ? "Wird gespeichert…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
