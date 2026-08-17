import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type OccupancyRow = {
  courseId: string;
  courseName: string;
  occupied: number;
  capacity: number;
};

export function OccupancyList({ rows }: { rows: OccupancyRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Auslastung nach Kurs</CardTitle>
        <CardDescription>Aktueller Stand, nur Kurse mit maximaler Teilnehmerzahl</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch kein Kurs mit maximaler Teilnehmerzahl angelegt.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kurs</TableHead>
                  <TableHead>Belegt</TableHead>
                  <TableHead>Auslastung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const percent = row.capacity > 0 ? Math.round((row.occupied / row.capacity) * 100) : 0;
                  return (
                    <TableRow key={row.courseId}>
                      <TableCell className="font-medium">{row.courseName}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {row.occupied} / {row.capacity}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{percent}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
