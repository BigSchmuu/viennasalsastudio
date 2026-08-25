import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";
import { listCheckinEvents } from "@/lib/actions/checkin";
import { CheckinClient } from "@/components/checkin/checkin-client";

export default async function CheckinPage() {
  const { isAdmin } = await requireAdminOrTeacher();
  const events = await listCheckinEvents();

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Event-Check-in</h1>
        <p className="text-muted-foreground">QR-Code scannen oder Namen suchen</p>
      </div>
      <CheckinClient events={events} isAdmin={isAdmin} />
    </div>
  );
}
