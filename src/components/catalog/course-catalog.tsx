"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { levelOptions, levelLabel, levelColor, levelBadgeStyle } from "@/lib/constants/levels";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export type CatalogCourseRow = {
  id: string;
  name: string;
  danceStyleId: string | null;
  danceStyleName: string;
  level: string | null;
  locationId: string;
  locationName: string;
  roomName: string | null;
  teacherNames: string[];
  nextOccurrenceDates: string[];
  entryDates: string[];
  hasOpenRegularBooking: boolean;
};

export type SimpleOption = { id: string; name: string };

export function CourseCatalog({
  courses,
  danceStyles,
  locations,
  isLoggedIn,
  hasMandate,
  hasReferralSource,
  dropinPricing,
}: {
  courses: CatalogCourseRow[];
  danceStyles: SimpleOption[];
  locations: SimpleOption[];
  isLoggedIn: boolean;
  hasMandate: boolean;
  hasReferralSource: boolean;
  dropinPricing: { normal: number; student: number };
}) {
  const router = useRouter();
  const [danceStyleId, setDanceStyleId] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [locationId, setLocationId] = useState(ALL);
  const [bookingCourse, setBookingCourse] = useState<CatalogCourseRow | null>(null);

  const filtered = useMemo(() => {
    return courses.filter((course) => {
      if (danceStyleId !== ALL && course.danceStyleId !== danceStyleId) return false;
      if (level !== ALL && course.level !== level) return false;
      if (locationId !== ALL && course.locationId !== locationId) return false;
      return true;
    });
  }, [courses, danceStyleId, level, locationId]);

  const filtersActive = danceStyleId !== ALL || level !== ALL || locationId !== ALL;

  function resetFilters() {
    setDanceStyleId(ALL);
    setLevel(ALL);
    setLocationId(ALL);
  }

  function handleBook(course: CatalogCourseRow) {
    if (!isLoggedIn) {
      router.push("/login?redirect=/kurse");
      return;
    }
    setBookingCourse(course);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Tanzstil</label>
          <Select value={danceStyleId} onValueChange={setDanceStyleId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Tanzstile</SelectItem>
              {danceStyles.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Level</label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Levels</SelectItem>
              {levelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Standort</label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Standorte</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtersActive && (
          <Button variant="outline" onClick={resetFilters}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          Noch keine Kurse vorhanden. Schau bald wieder vorbei!
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          Keine Kurse gefunden. Passe deine Filter an oder{" "}
          <button onClick={resetFilters} className="underline hover:text-foreground">
            setze sie zurück
          </button>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => (
            <Card
              key={course.id}
              className="border-l-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{ borderLeftColor: levelColor(course.level) }}
            >
              <Link href={`/kurse/${course.id}`} className="block">
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
                  <p className="text-sm text-muted-foreground">
                    {course.teacherNames.length > 0
                      ? course.teacherNames.join(", ")
                      : "Lehrer wird noch bekanntgegeben"}
                  </p>
                </CardContent>
              </Link>
              <CardFooter>
                <Button className="w-full rounded-full" onClick={() => handleBook(course)}>
                  Jetzt buchen
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {bookingCourse && (
        <BookingDialog
          open={bookingCourse !== null}
          onOpenChange={(open) => !open && setBookingCourse(null)}
          course={bookingCourse}
          hasMandate={hasMandate}
          hasReferralSource={hasReferralSource}
          dropinPricing={dropinPricing}
        />
      )}
    </div>
  );
}
