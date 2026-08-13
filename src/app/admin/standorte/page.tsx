import { createClient } from "@/lib/supabase/server";
import { LocationManager, type LocationRow } from "@/components/admin/locations/location-manager";

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("id, name, address, description, rooms(count)")
    .order("created_at", { ascending: true });

  const locations: LocationRow[] = (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    description: l.description,
    roomCount: l.rooms[0]?.count ?? 0,
  }));

  return <LocationManager locations={locations} />;
}
