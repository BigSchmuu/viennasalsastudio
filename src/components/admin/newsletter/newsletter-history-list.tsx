import { newsletterGroupLabel, type NewsletterGroup } from "@/lib/newsletter/recipients";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

export type NewsletterHistoryRow = {
  id: string;
  subject: string;
  sentAt: string;
  recipientGroup: NewsletterGroup;
  courseName: string | null;
  recipientCount: number;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NewsletterHistoryList({ rows }: { rows: NewsletterHistoryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Versandhistorie</CardTitle>
        <CardDescription>Bisher verschickte Newsletter</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Noch kein Newsletter verschickt.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead>Empfänger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.subject}</TableCell>
                    <TableCell>{formatDateTime(row.sentAt)}</TableCell>
                    <TableCell>
                      {newsletterGroupLabel[row.recipientGroup]}
                      {row.courseName ? ` — ${row.courseName}` : ""}
                    </TableCell>
                    <TableCell>{row.recipientCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
