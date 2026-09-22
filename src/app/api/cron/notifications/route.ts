import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runDailyChecks, runFollowupChecks, runEveningChecks, drainPendingQueue } from "@/lib/notifications/dispatch";
import { vollzieheFaelligeAenderungen } from "@/lib/subscriptions/faellige-aenderungen";
import { vollzieheFaelligeUmwandlungen } from "@/lib/courses/umwandlungen";
import { ergaenzeSerienTermine } from "@/lib/events/termine-nachlegen";
import { raeumeVerwaisteBilder } from "@/lib/events/bilder-aufraeumen";
import { fuehreSchrittAus, laufSammler } from "@/lib/cron/schritt";
import { laufArt } from "@/lib/cron/laufart";

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

  const art = laufArt(request.nextUrl.searchParams.get("run"));

  // Der kurze Lauf leert nur die Warteschlange und kehrt sofort um.
  // Bewusst als eigener Zweig und nicht als Kette von Ausnahmen weiter unten:
  // Ein Schritt, den jemand später hinzufügt, liefe sonst aus Versehen
  // sechsmal pro Stunde mit.
  //
  // Dass er sich mit dem Morgen- oder Abendlauf überschneidet, ist unkritisch:
  // Eine Zeile wird mit `status = 'pending'` in der Bedingung übernommen — wer
  // zuerst kommt, bekommt sie, der andere bekommt nichts.
  if (art === "warteschlange") {
    const nurWarteschlange = lauf.nimm(
      await fuehreSchrittAus("warteschlange", { processed: 0 }, () => drainPendingQueue(service))
    );
    return lauf.fehler.length > 0
      ? NextResponse.json({ ...nurWarteschlange, fehler: lauf.fehler }, { status: 500 })
      : NextResponse.json(nurWarteschlange);
  }

  // PROJ-29: the evening run (separate cron schedule, ?run=evening) only sends the
  // same-day trial reminder — the morning run keeps its existing checks plus the
  // second, next-occurrence-timed trial reminder.
  const isEveningRun = art === "abend";
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

  // PROJ-51: Vorgemerkte Kursumwandlungen — eine Woche vorher angekuendigt, am
  // Stichtag vollzogen. Derselbe Lauf wie beim Abo-Vollzug und aus demselben
  // Grund: Ein zweiter Mechanismus fuer "etwas wird zum Stichtag wirksam"
  // wuerde frueher oder spaeter anders antworten.
  const umwandlung = isEveningRun
    ? { angekuendigt: 0, umgewandelt: 0 }
    : lauf.nimm(
        await fuehreSchrittAus("kursumwandlung", { angekuendigt: 0, umgewandelt: 0 }, () =>
          vollzieheFaelligeUmwandlungen(service)
        )
      );

  // PROJ-54: Serientermine im Vorschaufenster auffuellen. Vier Wochen Vorlauf,
  // taeglich nachgelegt -- eine Serie ohne Ende braucht sonst irgendwann eine
  // Hand, die den naechsten Abend eintraegt.
  //
  // Nur im Morgenlauf: Ein Termin, der heute Nacht dazukommt, liegt vier
  // Wochen in der Zukunft. Zweimal taeglich braucht es dafuer nicht.
  const serien = isEveningRun
    ? { serien: 0, termine: 0 }
    : lauf.nimm(
        await fuehreSchrittAus("serientermine", { serien: 0, termine: 0 }, () => ergaenzeSerienTermine(service))
      );

  // PROJ-55: Bilddateien ohne Eintrag wegräumen. Die Datenbank räumt im
  // Bildspeicher nichts weg — verschwindet ein Event, bleibt die Datei liegen.
  //
  // Nur im Morgenlauf: Es eilt nicht, und die Schonfrist von einem Tag sorgt
  // ohnehin dafür, dass kein Upload mitten im Satz getroffen wird.
  const bilder = isEveningRun
    ? { verwaist: 0 }
    : lauf.nimm(await fuehreSchrittAus("verwaiste-bilder", { verwaist: 0 }, () => raeumeVerwaisteBilder(service)));

  const drained = lauf.nimm(await fuehreSchrittAus("warteschlange", { processed: 0 }, () => drainPendingQueue(service)));

  const ergebnis = { ...checks, ...vollzug, ...umwandlung, ...serien, ...bilder, ...drained };

  // Ein halb gelungener Lauf darf nicht wie ein gelungener aussehen: Vercel
  // zeigt in der Cron-Uebersicht nur den Statuscode.
  return lauf.fehler.length > 0
    ? NextResponse.json({ ...ergebnis, fehler: lauf.fehler }, { status: 500 })
    : NextResponse.json(ergebnis);
}
