import { createClient } from "@/lib/supabase/server";
import { FerienManager, type FerienZeile } from "@/components/admin/ferien/ferien-manager";

export default async function FerienPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_holidays")
    .select("id, name, starts_on, ends_on")
    .order("starts_on", { ascending: true });

  if (error) console.error("Ferien nicht lesbar", error);

  const ferien: FerienZeile[] = (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    von: f.starts_on,
    bis: f.ends_on,
  }));

  return <FerienManager ferien={ferien} />;
}
