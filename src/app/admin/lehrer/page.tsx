import { createClient } from "@/lib/supabase/server";
import { TeacherManager, type TeacherRow, type CustomerOption } from "@/components/admin/teachers/teacher-manager";

export default async function TeachersPage() {
  const supabase = await createClient();

  const [teacherProfilesRes, customerProfilesRes, emailsRes, courseTeachersRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "teacher"),
    supabase.from("profiles").select("id, full_name").eq("role", "customer"),
    supabase.rpc("admin_list_customer_emails"),
    supabase.from("course_teachers").select("teacher_id, courses(name)"),
  ]);

  const emailById = new Map((emailsRes.data ?? []).map((e) => [e.id, e.email]));

  const courseNamesByTeacher = new Map<string, string[]>();
  for (const row of courseTeachersRes.data ?? []) {
    const courseName = (row.courses as { name: string } | null)?.name;
    if (!courseName) continue;
    const list = courseNamesByTeacher.get(row.teacher_id) ?? [];
    list.push(courseName);
    courseNamesByTeacher.set(row.teacher_id, list);
  }

  const teachers: TeacherRow[] = (teacherProfilesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || "Unbenannt",
    email: emailById.get(p.id) ?? "—",
    courseNames: courseNamesByTeacher.get(p.id) ?? [],
  }));

  const customers: CustomerOption[] = (customerProfilesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || "Unbenannt",
    email: emailById.get(p.id) ?? "—",
  }));

  return <TeacherManager teachers={teachers} customers={customers} />;
}
