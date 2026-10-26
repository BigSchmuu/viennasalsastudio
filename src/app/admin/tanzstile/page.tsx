import { createClient } from "@/lib/supabase/server";
import { DanceStyleManager, type DanceStyleRow } from "@/components/admin/dance-styles/dance-style-manager";

export default async function DanceStylesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dance_styles")
    .select("id, name, pass_price, pass_student_price, courses(count)")
    .order("created_at", { ascending: true });

  const danceStyles: DanceStyleRow[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    courseCount: s.courses[0]?.count ?? 0,
    passPrice: s.pass_price,
    passStudentPrice: s.pass_student_price,
  }));

  return <DanceStyleManager danceStyles={danceStyles} />;
}
