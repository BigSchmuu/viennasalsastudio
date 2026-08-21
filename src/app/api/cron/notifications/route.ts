import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runDailyChecks, runFollowupChecks, runEveningChecks, drainPendingQueue } from "@/lib/notifications/dispatch";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // PROJ-29: the evening run (separate cron schedule, ?run=evening) only sends the
  // same-day trial reminder — the morning run keeps its existing checks plus the
  // second, next-occurrence-timed trial reminder.
  const isEveningRun = request.nextUrl.searchParams.get("run") === "evening";
  const checks = isEveningRun
    ? await runEveningChecks(service)
    : { ...(await runDailyChecks(service)), ...(await runFollowupChecks(service)) };

  const drained = await drainPendingQueue(service);

  return NextResponse.json({ ...checks, ...drained });
}
