"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseSchema, type CourseInput } from "@/lib/validations/admin";
import { createCourse, updateCourse, deleteCourse } from "@/lib/actions/admin/courses";
import { levelOptions, levelLabel, levelColor } from "@/lib/constants/levels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TeacherMultiSelect, type TeacherOption } from "@/components/admin/courses/teacher-multi-select";

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
};

export type SimpleOption = { id: string; name: string };
export type RoomOption = { id: string; name: string; locationId: string };

export function CourseManager({
  courses,
  danceStyles,
  locations,
  rooms,
  teachers,
  videoSets,
}: {
  courses: CourseRow[];
  danceStyles: SimpleOption[];
  locations: SimpleOption[];
  rooms: RoomOption[];
  teachers: TeacherOption[];
  videoSets: SimpleOption[];
}) {
  const [editing, setEditing] = useState<CourseRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
            Raum. Lege diese zuerst unter „Tanzstile" bzw. „Standorte" an.
          </AlertDescription>
        </Alert>
      )}

      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Noch keine Kurse vorhanden.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tanzstil</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Standort / Raum</TableHead>
              <TableHead>Lehrer</TableHead>
              <TableHead>Videosatz</TableHead>
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
                <TableCell className="text-right space-x-2">
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
        />
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kurs löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}" wird unwiderruflich gelöscht.
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CourseRow | null;
  danceStyles: SimpleOption[];
  locations: SimpleOption[];
  rooms: RoomOption[];
  teachers: TeacherOption[];
  videoSets: SimpleOption[];
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
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kein Videosatz" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {videoSets.map((videoSet) => (
                        <SelectItem key={videoSet.id} value={videoSet.id}>
                          {videoSet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Wird gespeichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
