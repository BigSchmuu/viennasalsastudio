"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mandateSchema, type MandateInput } from "@/lib/validations/sepa";
import { upsertMandate, revokeMandate } from "@/lib/actions/mandate";
import { maskIban } from "@/lib/sepa/iban";
import { SEPA_MANDATE_TEXT } from "@/lib/sepa/mandate-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type MandateData = {
  id: string;
  iban: string;
  accountHolderName: string;
  consentedAt: string;
};

export function PaymentMethodSection({ mandate: initialMandate }: { mandate: MandateData | null }) {
  const t = useTranslations("profile");
  const [mandate, setMandate] = useState(initialMandate);
  const [showForm, setShowForm] = useState(mandate === null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  async function handleRemove() {
    if (!mandate) return;
    setRemoveLoading(true);
    setRemoveError(null);
    try {
      const result = await revokeMandate(mandate.id);
      if ("error" in result) {
        setRemoveError(result.error);
        return;
      }
      setMandate(null);
      setShowForm(true);
      setRemoveOpen(false);
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {mandate && !showForm ? (
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm space-y-1">
            <p className="font-medium">{maskIban(mandate.iban)}</p>
            <p className="text-muted-foreground">{mandate.accountHolderName}</p>
            <p className="text-muted-foreground">
              Hinterlegt seit {new Date(mandate.consentedAt).toLocaleDateString("de-AT")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
              {t("replaceMandate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRemoveOpen(true);
                setRemoveError(null);
              }}
            >
              {t("removeMandate")}
            </Button>
          </div>
        </div>
      ) : (
        <MandateForm
          onSaved={(saved) => {
            setMandate(saved);
            setShowForm(false);
          }}
          onCancel={mandate ? () => setShowForm(false) : undefined}
        />
      )}

      <AlertDialog open={removeOpen} onOpenChange={(open) => !open && setRemoveOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeMandateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              Zukünftige Lastschriftläufe berücksichtigen dich nicht mehr, bis du ein neues Mandat hinterlegst.
              Dein Abo-Status ändert sich dadurch nicht automatisch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError && (
            <Alert variant="destructive">
              <AlertDescription>{removeError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeLoading}
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MandateForm({
  onSaved,
  onCancel,
}: {
  onSaved: (mandate: MandateData) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("profile");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<MandateInput>({
    resolver: zodResolver(mandateSchema),
    defaultValues: { iban: "", account_holder_name: "", consent: false },
  });

  async function onSubmit(values: MandateInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("iban", values.iban);
      formData.set("account_holder_name", values.account_holder_name);
      formData.set("consent", String(values.consent));

      const result = await upsertMandate(formData);
      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      onSaved(result.mandate);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="iban"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("iban")}</FormLabel>
              <FormControl>
                <Input placeholder="AT12 3456 7890 1234 5678" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="account_holder_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("accountHolder")}</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-line text-muted-foreground max-h-40 overflow-y-auto">
          {SEPA_MANDATE_TEXT}
        </div>

        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-row items-start gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                </FormControl>
                <FormLabel className="font-normal">{t("sepaConsent")}</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? t("saving") : t("saveMandate")}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
