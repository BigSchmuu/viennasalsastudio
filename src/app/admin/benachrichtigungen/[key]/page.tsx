import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTemplateMeta, isTemplateKey } from "@/lib/notifications/template-registry";
import { TemplateEditor } from "@/components/admin/notifications/template-editor";

export default async function NotificationTemplateEditPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isTemplateKey(key)) notFound();

  const meta = getTemplateMeta(key);
  if (!meta) notFound();

  const supabase = await createClient();
  const { data: override } = await supabase
    .from("notification_template_overrides")
    .select("email_subject, email_body, push_title, push_body")
    .eq("template_key", key)
    .maybeSingle();

  const initialFields = override
    ? {
        emailSubject: override.email_subject,
        emailBody: override.email_body,
        pushTitle: override.push_title,
        pushBody: override.push_body,
      }
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
      </div>

      <TemplateEditor
        templateKey={meta.key}
        placeholders={meta.placeholders}
        samples={meta.samples}
        initialFields={initialFields}
        isOverridden={!!override}
      />
    </div>
  );
}
