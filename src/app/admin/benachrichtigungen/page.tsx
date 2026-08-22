import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_REGISTRY } from "@/lib/notifications/template-registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function NotificationTemplatesPage() {
  const supabase = await createClient();
  const { data: overrides } = await supabase.from("notification_template_overrides").select("template_key");
  const overriddenKeys = new Set((overrides ?? []).map((row) => row.template_key));

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
