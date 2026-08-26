"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { levelOptions, levelLabel, levelBadgeStyle } from "@/lib/constants/levels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import type { StudioPricing } from "@/lib/pricing";
import { CoursePriceLine } from "@/components/catalog/course-price-line";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";
const PAGE_SIZE = 12;

// Loaded only once a customer actually opens a booking dialog, instead of
// being bundled into every /kurse page load.
const BookingDialog = dynamic(
  () => import("@/components/booking/booking-dialog").then((mod) => mod.BookingDialog),
  { ssr: false }
);

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
  /** Eigener Kurspreis; `null` = Standardpreis (PROJ-41). */
  price: number | null;
  hasOpenRegularBooking: boolean;
  hasActiveSubscription: boolean;
  isFull: boolean;
  isOnWaitlist: boolean;
  prerequisiteNote: string | null;
  roleQueryEnabled: boolean;
};

export type SimpleOption = { id: string; name: string };

export function CourseCatalog({
  courses,
  danceStyles,
  locations,
  isLoggedIn,
  hasMandate,
  hasReferralSource,
  pricing,
}: {
  courses: CatalogCourseRow[];
  danceStyles: SimpleOption[];
  locations: SimpleOption[];
  isLoggedIn: boolean;
  hasMandate: boolean;
  hasReferralSource: boolean;
  pricing: StudioPricing;
}) {
  const t = useTranslations("courses");
  const router = useRouter();
  const pathname = usePathname();

  // Die Startseite verlinkt je Stufe hierher (/kurse?level=beginner). Ohne
  // diese Zeilen stünde die Stufe zwar in der Adresse, der Katalog zeigte
  // aber weiter alles — genau das ist passiert.
  const searchParams = useSearchParams();

  // Die Stufe steht in der Adresse, nicht im Zustand der Komponente. Damit
  // kann beides gar nicht erst auseinanderlaufen — ein zweiter Verweis auf
  // eine andere Stufe wirkt sofort, ohne dass die Komponente neu montiert
  // werden müsste. Nebenbei ist ein gefilterter Katalog so verschickbar.
  const level = searchParams.get("level") ?? ALL;

  const [danceStyleId, setDanceStyleId] = useState(ALL);
  const [locationId, setLocationId] = useState(ALL);
  const [bookingCourse, setBookingCourse] = useState<CatalogCourseRow | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return courses.filter((course) => {
      if (danceStyleId !== ALL && course.danceStyleId !== danceStyleId) return false;
      if (level !== ALL && course.level !== level) return false;
      if (locationId !== ALL && course.locationId !== locationId) return false;
      return true;
    });
  }, [courses, danceStyleId, level, locationId]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const filtersActive = danceStyleId !== ALL || level !== ALL || locationId !== ALL;


  /** Schreibt die Stufe in die Adresse — dort lebt sie. */
  function setLevel(wert: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (wert === ALL) params.delete("level");
    else params.set("level", wert);
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
    setVisibleCount(PAGE_SIZE);
  }

  function resetFilters() {
    setDanceStyleId(ALL);
    setLevel(ALL);
    setLocationId(ALL);
    setVisibleCount(PAGE_SIZE);
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
          <label className="text-sm font-medium">{t("danceStyle")}</label>
          <Select
            value={danceStyleId}
            onValueChange={(value) => {
              setDanceStyleId(value);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allDanceStyles")}</SelectItem>
              {danceStyles.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t("level")}</label>
          <Select
            value={level}
            onValueChange={(value) => {
              setLevel(value);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allLevels")}</SelectItem>
              {levelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t("location")}</label>
          <Select
            value={locationId}
            onValueChange={(value) => {
              setLocationId(value);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allLocations")}</SelectItem>
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
          {t("emptyAll")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          {t("emptyFiltered")}{" "}
          <button onClick={resetFilters} className="underline hover:text-foreground">
            {t("resetFilters")}
          </button>
          .
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((course) => (
              <Card
                key={course.id}
                className="group flex flex-col rounded-card border-border/70 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
              >
                <Link href={`/kurse/${course.id}`} className="block flex-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="transition-colors group-hover:text-primary">{course.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{course.danceStyleName}</Badge>
                      <Badge variant="outline" style={levelBadgeStyle(course.level)}>
                        {levelLabel(course.level)}
                      </Badge>
                      {course.isFull && <Badge variant="destructive">{t("soldOut")}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {course.roomName ? `${course.locationName} · ${course.roomName}` : course.locationName}
                    </p>
                    {/* Ein noch offener Lehrer bleibt sichtbar (PROJ-5), tritt
                        aber zurück: Ein feststehender Name ist ein Grund für
                        die Wahl, „wird noch bekanntgegeben" ist es nicht. */}
                    {course.teacherNames.length > 0 ? (
                      <p className="text-sm text-muted-foreground">{course.teacherNames.join(", ")}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">{t("teacherTba")}</p>
                    )}
                    <CoursePriceLine pricing={pricing} coursePrice={course.price} className="text-sm" />
                    {course.prerequisiteNote && (
                      <p className="text-xs bg-muted rounded-lg px-2 py-1">{course.prerequisiteNote}</p>
                    )}
                  </CardContent>
                </Link>
                <CardFooter>
                  {/* Vorher: zwölf vollflächig rote Knöpfe übereinander. Eine
                      Akzentfarbe wirkt nur, solange sie selten ist — das Rot
                      bleibt jetzt der Buchung im Dialog vorbehalten. */}
                  <Button
                    variant="outline"
                    className="w-full border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleBook(course)}
                  >
                    {t("book")}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                {t("loadMore", { count: filtered.length - visibleCount })}
              </Button>
            </div>
          )}
        </>
      )}

      {bookingCourse && (
        <BookingDialog
          open={bookingCourse !== null}
          onOpenChange={(open) => !open && setBookingCourse(null)}
          course={bookingCourse}
          hasMandate={hasMandate}
          hasReferralSource={hasReferralSource}
          pricing={pricing}
        />
      )}
    </div>
  );
}
