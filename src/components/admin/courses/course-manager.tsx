"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseSchema, type CourseInput } from "@/lib/validations/admin";
import { createCourse, updateCourse, deleteCourse } from "@/lib/actions/admin/courses";
import { levelOptions, levelLabel, levelColor } from "@/lib/constants/levels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SortableHeader } from "@/components/admin/sortable-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TeacherMultiSelect, type TeacherOption } from "@/components/admin/courses/teacher-multi-select";
import {
  CourseScheduleSection,
  type ScheduleData,
  type PauseData,
} from "@/components/admin/courses/course-schedule-section";
import {
  CourseEntryDatesSection,
  type EntryDateData,
} from "@/components/admin/courses/course-entry-dates-section";
import { CourseWaitlistDialog, type WaitlistEntryRow } from "@/components/admin/courses/course-waitlist-dialog";

export type CourseRow = {
  id: string;
  name: string;
  level: string | null;
  danceStyleId: string | null;
  danceStyleName: string;
  roomId: string;
  roomName: string;
  locationId: string;
  locationName: string;
  teacherIds: string[];
  teacherNames: string[];
  videoSetId: string | null;
  videoSetName: string | null;
  schedule: ScheduleData | null;
  pauses: PauseData[];
  entryDates: EntryDateData[];
  maxParticipants: number | null;
  price: number | null;
  prerequisiteNote: string | null;
  occupiedCount: number;
  waitlistEntries: WaitlistEntryRow[];
  roleQueryEnabled: boolean;
  maxRoleDifference: number | null;
  roleCounts: { leader: number; follower: number; both: number };
};

export type SimpleOption = { id: string; name: string };
export type RoomOption = { id: string; name: string; locationId: string };
export type VideoSetOption = { id: string; name: string; level: string | null };

const NO_VIDEO_SET = "__none__";
const ALL_LEVELS = "__all__";
const ALL_STYLES = "__all__";

export function CourseManager({
  courses,
  danceStyles,
  locations,
  rooms,
  teachers,
  videoSets,
  initialLevel,
  initialDanceStyle,
  standardCoursePrice,
}: {
  courses: CourseRow[];
  danceStyles: SimpleOption[];
  locations: SimpleOption[];
  rooms: RoomOption[];
  teachers: TeacherOption[];
  videoSets: VideoSetOption[];
  initialLevel: string;
  initialDanceStyle: string;
  /** PROJ-41: Standardpreis für Kursabos; `null`, wenn keiner gepflegt ist. */
  standardCoursePrice: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<CourseRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [waitlistTarget, setWaitlistTarget] = useState<CourseRow | null>(null);

  function applyListFilter(key: "level" | "dance_style", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/kurse${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const listFiltersActive = initialLevel !== "" || initialDanceStyle !== "";

  function resetListFilters() {
    router.push("/admin/kurse");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteCourse(deleteTarget.id);
    if ("error" in result) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
    setDeleteError(null);
  }

  const canCreate = danceStyles.length > 0 && rooms.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} disabled={!canCreate}>
          Neuer Kurs
        </Button>
      </div>

      {!canCreate && (
        <Alert>
          <AlertDescription>
            Bevor du einen Kurs anlegen kannst, brauchst du mindestens einen Tanzstil und einen
            Raum. Lege diese zuerst unter „Tanzstile&quot; bzw. „Standorte&quot; an.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="course-level-filter">Level filtern</Label>
          <Select
            value={initialLevel || ALL_LEVELS}
            onValueChange={(value) => applyListFilter("level", value === ALL_LEVELS ? "" : value)}
          >
            <SelectTrigger id="course-level-filter" className="w-40">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LEVELS}>Alle</SelectItem>
              {levelOptions.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="course-style-filter">Tanzstil filtern</Label>
          <Select
            value={initialDanceStyle || ALL_STYLES}
            onValueChange={(value) => applyListFilter("dance_style", value === ALL_STYLES ? "" : value)}
          >
            <SelectTrigger id="course-style-filter" className="w-40">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STYLES}>Alle</SelectItem>
              {danceStyles.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {listFiltersActive && (
          <Button type="button" variant="outline" size="sm" onClick={resetListFilters}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {listFiltersActive ? "Keine Kurse gefunden." : "Noch keine Kurse vorhanden."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Name" sortKey="name" />
              <TableHead>Tanzstil</TableHead>
              <SortableHeader label="Level" sortKey="level" />
              <TableHead>Standort / Raum</TableHead>
              <TableHead>Lehrer</TableHead>
              <TableHead>Videosatz</TableHead>
              <TableHead>Kapazität</TableHead>
              <TableHead>Rollen</TableHead>
              <TableHead>Warteliste</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.name}</TableCell>
                <TableCell>{course.danceStyleName}</TableCell>
                <TableCell>
                  <Badge style={{ backgroundColor: levelColor(course.level), color: "white" }}>
                    {levelLabel(course.level)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {course.locationName} / {course.roomName}
                </TableCell>
                <TableCell>{course.teacherNames.join(", ") || "—"}</TableCell>
                <TableCell>{course.videoSetName || "—"}</TableCell>
                <TableCell>
                  {course.maxParticipants === null ? (
                    "Unbegrenzt"
                  ) : course.occupiedCount > course.maxParticipants ? (
                    <span className="text-destructive font-medium">
                      {course.occupiedCount} / {course.maxParticipants} (überbelegt)
                    </span>
                  ) : (
                    `${course.occupiedCount} / ${course.maxParticipants}`
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {course.roleQueryEnabled
                    ? `${course.roleCounts.leader} L / ${course.roleCounts.follower} F / ${course.roleCounts.both} B`
                    : "—"}
                </TableCell>
                <TableCell>
                  {course.waitlistEntries.length === 0 ? (
                    "—"
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setWaitlistTarget(course)}>
                      {course.waitlistEntries.length} wartend
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/lehrer/${course.id}`}>Anwesenheit</Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(course)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(course);
                      setDeleteError(null);
                    }}
                  >
                    Löschen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing !== null && (
        <CourseFormDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          course={editing === "new" ? null : editing}
          danceStyles={danceStyles}
          locations={locations}
          rooms={rooms}
          teachers={teachers}
          videoSets={videoSets}
          standardCoursePrice={standardCoursePrice}
        />
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kurs löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}&quot; wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {waitlistTarget !== null && (
        <CourseWaitlistDialog
          open={waitlistTarget !== null}
          onOpenChange={(open) => !open && setWaitlistTarget(null)}
          courseName={waitlistTarget.name}
          entries={waitlistTarget.waitlistEntries}
        />
      )}
    </div>
  );
}

function CourseFormDialog({
  open,
  onOpenChange,
  course,
  danceStyles,
  locations,
  rooms,
  teachers,
  videoSets,
  standardCoursePrice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CourseRow | null;
  danceStyles: SimpleOption[];
  locations: SimpleOption[];
  rooms: RoomOption[];
  teachers: TeacherOption[];
  videoSets: VideoSetOption[];
  standardCoursePrice: number | null;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationId, setLocationId] = useState(course?.locationId ?? "");

  const form = useForm<CourseInput>({
    resolver: zodResolver(courseSchema),
    values: {
      name: course?.name ?? "",
      dance_style_id: course?.danceStyleId ?? "",
      level: (course?.level as CourseInput["level"]) ?? undefined,
      room_id: course?.roomId ?? "",
      video_set_id: course?.videoSetId ?? "",
      teacher_ids: course?.teacherIds ?? [],
      max_participants: course?.maxParticipants != null ? String(course.maxParticipants) : "",
      price: course?.price != null ? String(course.price) : "",
      prerequisite_note: course?.prerequisiteNote ?? "",
      role_query_enabled: course?.roleQueryEnabled ?? false,
      max_role_difference: course?.maxRoleDifference != null ? String(course.maxRoleDifference) : "",
    },
  });

  const roomsForLocation = rooms.filter((r) => r.locationId === locationId);

  async function onSubmit(values: CourseInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("dance_style_id", values.dance_style_id);
      formData.set("level", values.level);
      formData.set("room_id", values.room_id);
      formData.set("video_set_id", values.video_set_id ?? "");
      formData.set("max_participants", values.max_participants ?? "");
      formData.set("price", values.price ?? "");
      formData.set("prerequisite_note", values.prerequisite_note ?? "");
      formData.set("role_query_enabled", String(values.role_query_enabled ?? false));
      formData.set("max_role_difference", values.max_role_difference ?? "");
      (values.teacher_ids ?? []).forEach((id) => formData.append("teacher_ids", id));

      const result = course
        ? await updateCourse(course.id, formData)
        : await createCourse(formData);

      if ("error" in result) {
        setFormError(result.error);
        return;
      }

      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? "Kurs bearbeiten" : "Neuer Kurs"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dance_style_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanzstil</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {danceStyles.map((style) => (
                        <SelectItem key={style.id} value={style.id}>
                          {style.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {levelOptions.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="course-location">Standort</Label>
              <Select
                value={locationId || undefined}
                onValueChange={(value) => {
                  setLocationId(value);
                  form.setValue("room_id", "");
                }}
              >
                <SelectTrigger id="course-location">
                  <SelectValue placeholder="Bitte wählen" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FormField
              control={form.control}
              name="room_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raum</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={!locationId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={locationId ? "Bitte wählen" : "Erst Standort wählen"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomsForLocation.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teacher_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lehrer</FormLabel>
                  <FormControl>
                    <TeacherMultiSelect
                      teachers={teachers}
                      selected={field.value ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="video_set_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Videosatz (optional, nur für Lehrer sichtbar)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === NO_VIDEO_SET ? "" : value)}
                    value={field.value || NO_VIDEO_SET}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kein Videosatz" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_VIDEO_SET}>Kein Videosatz</SelectItem>
                      {videoSets.map((videoSet) => (
                        <SelectItem key={videoSet.id} value={videoSet.id}>
                          {videoSet.name}
                          {videoSet.level ? ` (${levelLabel(videoSet.level)})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_participants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max. Teilnehmer (optional, leer = unbegrenzt)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preis pro Monat in €</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={standardCoursePrice != null ? String(standardCoursePrice) : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {standardCoursePrice != null
                      ? `Leer lassen, damit der Standardpreis von ${standardCoursePrice} € gilt. Ein Betrag hier gilt nur für diesen Kurs.`
                      : "Es ist kein Standardpreis gepflegt — trage hier einen Betrag ein oder setze den Standard unter Verwaltung → Buchungen."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prerequisite_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Hinweis/Vorkenntnisse (optional, muss vor der Buchung bestätigt werden)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="z.B. Baut auf Salsa Beginner 1 auf"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role_query_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <FormLabel className="font-normal">Leader/Follower-Abfrage aktivieren</FormLabel>
                  <FormControl>
                    <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("role_query_enabled") && (
              <FormField
                control={form.control}
                name="max_role_difference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. Rollen-Differenz (optional, leer = keine Beschränkung)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Wird gespeichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {course && (
          <>
            <CourseScheduleSection courseId={course.id} schedule={course.schedule} pauses={course.pauses} />
            <CourseEntryDatesSection courseId={course.id} entryDates={course.entryDates} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
