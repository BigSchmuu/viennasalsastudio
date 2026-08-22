"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { sendNotificationEmail } from "@/lib/notifications/mailer";
import { sendPushToCustomer } from "@/lib/notifications/push";
import { buildPreviewContent, type NotificationContent } from "@/lib/notifications/templates";
import {
  isTemplateKey,
  getTemplateMeta,
  findInvalidPlaceholders,
  type TemplateFields,
} from "@/lib/notifications/template-registry";
import type { ActionResult } from "@/lib/actions/types";

/** Server-side backstop (never trust the client-side check alone, see security.md):
 *  every field must be non-empty, and every {placeholder} used must be one this
 *  template actually supports. */
function validateFields(templateKey: string, fields: TemplateFields): string | null {
  const meta = getTemplateMeta(templateKey);
  if (!meta) return "Unbekannte Vorlage.";

  if (
    !fields.emailSubject.trim() ||
    !fields.emailBody.trim() ||
    !fields.pushTitle.trim() ||
    !fields.pushBody.trim()
  ) {
    return "Alle vier Felder müssen ausgefüllt sein.";
  }

  const invalid = new Set<string>();
  for (const text of [fields.emailSubject, fields.emailBody, fields.pushTitle, fields.pushBody]) {
    for (const name of findInvalidPlaceholders(text, meta.placeholders)) invalid.add(name);
  }
  if (invalid.size > 0) {
    const invalidList = [...invalid].map((p) => `{${p}}`).join(", ");
    const allowedList = meta.placeholders.map((p) => `{${p}}`).join(", ");
    return `Unbekannte Platzhalter: ${invalidList}. Erlaubt sind: ${allowedList}.`;
  }
  return null;
}

export async function previewTemplate(
  templateKey: string,
  fields: TemplateFields
): Promise<NotificationContent | { error: string }> {
  if (!isTemplateKey(templateKey)) return { error: "Unbekannte Vorlage." };
  const validationError = validateFields(templateKey, fields);
  if (validationError) return { error: validationError };
  return buildPreviewContent(templateKey, fields);
}

export async function saveTemplate(templateKey: string, fields: TemplateFields): Promise<ActionResult> {
  if (!isTemplateKey(templateKey)) return { error: "Unbekannte Vorlage." };
  const validationError = validateFields(templateKey, fields);
  if (validationError) return { error: validationError };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("notification_template_overrides").upsert({
    template_key: templateKey,
    email_subject: fields.emailSubject.trim(),
    email_body: fields.emailBody.trim(),
    push_title: fields.pushTitle.trim(),
    push_body: fields.pushBody.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Speichern fehlgeschlagen." };

  revalidatePath("/admin/benachrichtigungen");
  revalidatePath(`/admin/benachrichtigungen/${templateKey}`);
  return { success: true };
}

export async function resetTemplate(templateKey: string): Promise<ActionResult> {
  if (!isTemplateKey(templateKey)) return { error: "Unbekannte Vorlage." };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("notification_template_overrides").delete().eq("template_key", templateKey);
  if (error) return { error: "Zurücksetzen fehlgeschlagen." };

  revalidatePath("/admin/benachrichtigungen");
  revalidatePath(`/admin/benachrichtigungen/${templateKey}`);
  return { success: true };
}

/** Sends the currently-edited (possibly unsaved) template to the logged-in
 *  admin's own account, with sample data — bypasses the notification_queue
 *  entirely (see PROJ-34 Tech Design: not a real business event). */
export async function sendTestNotification(templateKey: string, fields: TemplateFields): Promise<ActionResult> {
  if (!isTemplateKey(templateKey)) return { error: "Unbekannte Vorlage." };
  const validationError = validateFields(templateKey, fields);
  if (validationError) return { error: validationError };

  const { user } = await requireAdmin();
  if (!user.email) return { error: "Für deinen Admin-Account ist keine E-Mail-Adresse hinterlegt." };

  const content = buildPreviewContent(templateKey, fields);

  try {
    await sendNotificationEmail(user.email, `[Test] ${content.subject}`, content.emailHtml);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Test-Mail konnte nicht gesendet werden." };
  }

  // Push delivery is best-effort (e.g. admin has no registered device) — a
  // failed/skipped push must not turn a successfully-sent test email into an error.
  const service = createServiceClient();
  await sendPushToCustomer(service, user.id, {
    title: `[Test] ${content.pushTitle}`,
    body: content.pushBody,
    url: content.url,
  });

  return { success: true };
}
