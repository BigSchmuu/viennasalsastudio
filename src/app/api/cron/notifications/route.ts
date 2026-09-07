import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runDailyChecks, runFollowupChecks, runEveningChecks, drainPendingQueue } from "@/lib/notifications/dispatch";
import { vollzieheFaelligeAenderungen } from "@/lib/subscriptions/faellige-aenderungen";
import { fuehreSchrittAus, laufSammler } from "@/lib/cron/schritt";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Jeder Schritt ist einzeln abgesichert. Vorher lief alles ungeschuetzt
  // hintereinander: warf der erste, blieb der Rest ungetan -- auch der Vollzug
  // faelliger Kuendigungen, und das heisst im Klartext, dass weiter abgebucht
  // wird. Ein Ausfall soll den betroffenen Schritt kosten, nicht den Lauf.
  const lauf = laufSammler();

  // PROJ-29: the evening run (separate cron schedule, ?run=evening) only sends the
  // same-day trial reminder — the morning run keeps its existing checks plus the
  // second, next-occurrence-timed trial reminder.
  const isEveningRun = request.nextUrl.searchParams.get("run") === "evening";
  const checks = isEveningRun
    ? lauf.nimm(await fuehreSchrittAus("abendlauf", { evening: 0 }, () => runEveningChecks(service)))
    : {
        ...lauf.nimm(
          await fuehreSchrittAus("tageslauf", { reminders: 0, effective: 0 }, () => runDailyChecks(service))
        ),
        ...lauf.nimm(await fuehreSchrittAus("nachfassen", { followup: 0 }, () => runFollowupChecks(service))),
      };

  // Geplante Abo-Aenderungen vollziehen, deren Stichtag erreicht ist. Bis
  // hierher war das Handarbeit -- der Lauf verschickte am Stichtag nur eine
  // Nachricht. Blieb der Vollzug aus, war das Abo formal weiter aktiv und
  // `cancelled_at` leer; die Kuendigung fehlte damit in der Auswertung.
  //
  // Nur im Morgenlauf: Zweimal taeglich braucht es nicht, und ein Stichtag
  // gehoert an den Tagesanfang.
  const vollzug = isEveningRun
    ? { vollzogen: 0, gekuendigt: 0 }
    : lauf.nimm(
        await fuehreSchrittAus("abo-vollzug", { vollzogen: 0, gekuendigt: 0, freigewordeneKurse: [] }, () =>
          vollzieheFaelligeAenderungen(service)
        )
      );

  const drained = lauf.nimm(await fuehreSchrittAus("warteschlange", { processed: 0 }, () => drainPendingQueue(service)));

  const ergebnis = { ...checks, ...vollzug, ...drained };

  // Ein halb gelungener Lauf darf nicht wie ein gelungener aussehen: Vercel
  // zeigt in der Cron-Uebersicht nur den Statuscode.
  return lauf.fehler.length > 0
    ? NextResponse.json({ ...ergebnis, fehler: lauf.fehler }, { status: 500 })
    : NextResponse.json(ergebnis);
}
