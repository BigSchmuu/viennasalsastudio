import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomManager, type RoomRow } from "@/components/admin/rooms/room-manager";
import { Button } from "@/components/ui/button";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!location) {
    notFound();
  }

  const { data: roomsData } = await supabase
    .from("rooms")
    .select("id, name, courses(count)")
    .eq("location_id", id)
    .order("created_at", { ascending: true });

  const rooms: RoomRow[] = (roomsData ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    courseCount: r.courses[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Button variant="link" className="px-0" asChild>
          <Link href="/admin/standorte">← Zurück zu Standorten</Link>
        </Button>
        <h2 className="font-heading text-xl font-bold">{location.name}</h2>
        <p className="text-sm text-muted-foreground">Räume verwalten</p>
      </div>
      <RoomManager locationId={id} rooms={rooms} />
    </div>
  );
}
