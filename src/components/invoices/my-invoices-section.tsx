import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useLocale, useTranslations } from "next-intl";

export type MyInvoiceRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  grossAmount: number;
  bounced: boolean;
};

function formatEUR(amount: number): string {
  return amount.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function MyInvoicesSection({ invoices }: { invoices: MyInvoiceRow[] }) {
  const t = useTranslations("profile");
  const locale = useLocale();
  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{t("noInvoices")}</p>;
  }

  return (
    <ul className="space-y-2">
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <Link
            href={`/rechnungen/${invoice.id}`}
            className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">{invoice.description}</p>
              <p className="text-muted-foreground">
                {formatDate(invoice.invoiceDate)} · {invoice.invoiceNumber}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatEUR(invoice.grossAmount)}</span>
              <Badge variant={invoice.bounced ? "destructive" : "default"}>
                {invoice.bounced ? t("invoiceBounced") : t("invoicePaid")}
              </Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
