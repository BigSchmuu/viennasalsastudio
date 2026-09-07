import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runDailyChecks, runFollowupChecks, runEveningChecks, drainPendingQueue } from "@/lib/notifications/dispatch";
import { vollzieheFaelligeAenderungen } from "@/lib/subscriptions/faellige-aenderungen";

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

  // Geplante Abo-Aenderungen vollziehen, deren Stichtag erreicht ist. Bis
  // hierher war das Handarbeit -- der Lauf verschickte am Stichtag nur eine
  // Nachricht. Blieb der Vollzug aus, war das Abo formal weiter aktiv und
  // `cancelled_at` leer; die Kuendigung fehlte damit in der Auswertung.
  //
  // Nur im Morgenlauf: Zweimal taeglich braucht es nicht, und ein Stichtag
  // gehoert an den Tagesanfang.
  const vollzug = isEveningRun
    ? { vollzogen: 0, gekuendigt: 0 }
    : await vollzieheFaelligeAenderungen(service);

  const drained = await drainPendingQueue(service);

  return NextResponse.json({ ...checks, ...vollzug, ...drained });
}
