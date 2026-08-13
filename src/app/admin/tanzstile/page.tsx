import { createClient } from "@/lib/supabase/server";
import { DanceStyleManager, type DanceStyleRow } from "@/components/admin/dance-styles/dance-style-manager";

export default async function DanceStylesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dance_styles")
    .select("id, name, courses(count)")
    .order("created_at", { ascending: true });

  const danceStyles: DanceStyleRow[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    courseCount: s.courses[0]?.count ?? 0,
  }));

  return <DanceStyleManager danceStyles={danceStyles} />;
}
