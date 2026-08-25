import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTemplateMeta, isTemplateKey } from "@/lib/notifications/template-registry";
import { TemplateEditor } from "@/components/admin/notifications/template-editor";

export default async function NotificationTemplateEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ sprache?: string }>;
}) {
  const { key } = await params;
  // PROJ-43: Welche Sprachfassung bearbeitet wird, steht in der Adresse — so
  // bleibt sie beim Neuladen nach dem Speichern erhalten.
  const sprache = (await searchParams).sprache === "en" ? "en" : "de";
  if (!isTemplateKey(key)) notFound();

  const meta = getTemplateMeta(key);
  if (!meta) notFound();

  const supabase = await createClient();
  const { data: override } = await supabase
    .from("notification_template_overrides")
    .select("email_subject, email_body, push_title, push_body")
    .eq("template_key", key)
    .eq("language", sprache)
    .maybeSingle();

  const initialFields = override
    ? {
        emailSubject: override.email_subject,
        emailBody: override.email_body,
        pushTitle: override.push_title,
        pushBody: override.push_body,
      }
    : sprache === "en"
      ? meta.defaultsEn
      : meta.defaults;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/benachrichtigungen" className="text-sm text-muted-foreground hover:text-foreground">
          ← Zurück zur Übersicht
        </Link>
        <h2 className="font-heading text-xl font-bold mt-1">
          {meta.eventGroupLabel}: {meta.variantLabel}
        </h2>
        <div className="mt-3 flex gap-2 text-sm">
          {(["de", "en"] as const).map((option) => (
            <Link
              key={option}
              href={`/admin/benachrichtigungen/${meta.key}?sprache=${option}`}
              className={
                option === sprache
                  ? "rounded bg-muted px-3 py-1 font-medium"
                  : "rounded px-3 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              {option === "de" ? "Deutsche Fassung" : "Englische Fassung"}
            </Link>
          ))}
        </div>
      </div>

      <TemplateEditor
        templateKey={meta.key}
        placeholders={meta.placeholders}
        samples={meta.samples}
        initialFields={initialFields}
        isOverridden={!!override}
        language={sprache}
      />
    </div>
  );
}
