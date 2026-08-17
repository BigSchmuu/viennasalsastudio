import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runDailyChecks, drainPendingQueue } from "@/lib/notifications/dispatch";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const checks = await runDailyChecks(service);
  const drained = await drainPendingQueue(service);

  return NextResponse.json({ ...checks, ...drained });
}
