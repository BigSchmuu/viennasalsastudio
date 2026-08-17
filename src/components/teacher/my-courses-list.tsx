import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { levelLabel, levelBadgeStyle } from "@/lib/constants/levels";

export type MyCourseRow = {
  id: string;
  name: string;
  level: string | null;
  danceStyleName: string;
  locationName: string;
  roomName: string | null;
};

export function MyCoursesList({ courses }: { courses: MyCourseRow[] }) {
  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground py-16 text-center">Dir sind noch keine Kurse zugewiesen.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((course) => (
        <Link key={course.id} href={`/lehrer/${course.id}`}>
          <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-lg h-full">
            <CardHeader>
              <CardTitle>{course.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{course.danceStyleName}</Badge>
                <Badge variant="outline" style={levelBadgeStyle(course.level)}>
                  {levelLabel(course.level)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {course.roomName ? `${course.locationName} · ${course.roomName}` : course.locationName}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
