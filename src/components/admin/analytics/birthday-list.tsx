import { Cake } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KundenLink } from "@/components/admin/customers/kunden-link";

export type BirthdayRow = {
  customerId: string;
  name: string;
  monthDay: string;
  daysUntil: number;
};

export function BirthdayList({ rows }: { rows: BirthdayRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Cake className="h-5 w-5 text-primary" />
          Geburtstage
        </CardTitle>
        <CardDescription>In den nächsten 7 Tagen</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Geburtstage in den nächsten 7 Tagen</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.customerId} className="flex items-center justify-between text-sm">
                <KundenLink kundeId={row.customerId}>
                  {row.name}
                </KundenLink>
                <span className="text-muted-foreground whitespace-nowrap">
                  {row.daysUntil === 0 ? "Heute" : row.monthDay}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
