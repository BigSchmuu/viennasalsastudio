import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_REGISTRY } from "@/lib/notifications/template-registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FailedDeliveries,
  type FehlgeschlageneSendung,
} from "@/components/admin/notifications/failed-deliveries";
import { notificationEventTypeLabel } from "@/lib/constants/notifications";

export default async function NotificationTemplatesPage() {
  const supabase = await createClient();
  const [{ data: overrides }, fehlgeschlagen] = await Promise.all([
    supabase.from("notification_template_overrides").select("template_key"),
    // Über eine abgesicherte Funktion, nicht über die Tabelle: Die
    // Warteschlange hat RLS ohne Policies, eine gewöhnliche Abfrage käme leer
    // und ohne Fehler zurück — ununterscheidbar von „alles zugestellt".
    supabase.rpc("admin_list_failed_notifications", { p_limit: 50 }),
  ]);
  const overriddenKeys = new Set((overrides ?? []).map((row) => row.template_key));

  if (fehlgeschlagen.error) {
    console.error("Fehlgeschlagene Sendungen nicht lesbar", fehlgeschlagen.error);
  }

  const sendungen: FehlgeschlageneSendung[] = (fehlgeschlagen.data ?? []).map((z) => ({
    id: z.id,
    // Der Ereignistyp ist ein technischer Schlüssel. Wo es eine Beschriftung
    // gibt, steht sie da — sonst der Schlüssel, statt gar nichts.
    ereignis: notificationEventTypeLabel[z.event_type] ?? z.event_type,
    kunde: z.customer_name,
    perEmail: z.email_status,
    perPush: z.push_status,
    fehler: z.error_detail,
    zeitpunkt: z.processed_at ?? z.created_at,
  }));

  const groups = new Map<string, typeof TEMPLATE_REGISTRY>();
  for (const meta of TEMPLATE_REGISTRY) {
    const existing = groups.get(meta.eventGroupLabel) ?? [];
    existing.push(meta);
    groups.set(meta.eventGroupLabel, existing);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Benachrichtigungs-Texte</h2>
        <p className="text-sm text-muted-foreground">
          Betreff und Text der automatischen Kunden-E-Mails/Push-Benachrichtigungen bearbeiten.
        </p>
      </div>

      {/* Zuerst, was schiefging: Die Texte kann der Betreiber jederzeit
          bearbeiten, eine nicht angekommene Bestätigung duldet keinen
          Aufschub. */}
      <FailedDeliveries sendungen={sendungen} lesefehler={Boolean(fehlgeschlagen.error)} />

      <div className="space-y-6">
        {[...groups.entries()].map(([groupLabel, templates]) => (
          <div key={groupLabel} className="rounded-md border">
            <div className="border-b bg-muted/40 px-4 py-2">
              <p className="text-sm font-semibold">{groupLabel}</p>
            </div>
            <ul className="divide-y">
              {templates.map((meta) => {
                const isOverridden = overriddenKeys.has(meta.key);
                return (
                  <li key={meta.key} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{meta.variantLabel}</span>
                      <Badge variant={isOverridden ? "default" : "outline"}>
                        {isOverridden ? "Angepasst" : "Standard"}
                      </Badge>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/benachrichtigungen/${meta.key}`}>Bearbeiten</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
