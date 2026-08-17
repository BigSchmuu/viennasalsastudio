import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CourseOccurrenceList({
  courseId,
  upcoming,
  past,
}: {
  courseId: string;
  upcoming: string[];
  past: string[];
}) {
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Für diesen Kurs ist noch kein Wochentermin hinterlegt.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">Anstehende Termine</h2>
          <div className="space-y-2">
            {upcoming.map((date) => (
              <OccurrenceCard key={date} courseId={courseId} date={date} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">Vergangene Termine</h2>
          <div className="space-y-2">
            {past.map((date) => (
              <OccurrenceCard key={date} courseId={courseId} date={date} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OccurrenceCard({ courseId, date }: { courseId: string; date: string }) {
  return (
    <Link href={`/lehrer/${courseId}/${date}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="py-3 flex items-center justify-between">
          <span className="text-sm font-medium">{formatDate(date)}</span>
          <Badge variant="outline">Anwesenheit &amp; Notiz</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
