"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueNotification } from "@/lib/notifications/dispatch";
import { resolveRecipientIds, newsletterGroupValues, type NewsletterGroup } from "@/lib/newsletter/recipients";
import type { ActionResult } from "@/lib/actions/types";

function isValidGroup(value: string): value is NewsletterGroup {
  return (newsletterGroupValues as readonly string[]).includes(value);
}

export async function previewRecipientCount(
  group: string,
  courseId?: string
): Promise<{ count: number } | { error: string }> {
  if (!isValidGroup(group)) {
    return { error: "Ungültige Empfängergruppe" };
  }
  const { supabase } = await requireAdmin();
  const recipientIds = await resolveRecipientIds(supabase, group, courseId);
  return { count: recipientIds.length };
}

export async function sendNewsletter(
  subject: string,
  body: string,
  group: string,
  courseId?: string
): Promise<ActionResult & { recipientCount?: number }> {
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();

  if (!trimmedSubject || !trimmedBody) {
    return { error: "Betreff und Text dürfen nicht leer sein" };
  }
  if (!isValidGroup(group)) {
    return { error: "Ungültige Empfängergruppe" };
  }
  if (group === "kurs_teilnehmer" && !courseId) {
    return { error: "Bitte einen Kurs auswählen" };
  }

  const { supabase, user } = await requireAdmin();

  const recipientIds = await resolveRecipientIds(supabase, group, courseId);
  if (recipientIds.length === 0) {
    return { error: "Diese Gruppe hat aktuell keine Empfänger" };
  }

  const { data: send, error: insertError } = await supabase
    .from("newsletter_sends")
    .insert({
      subject: trimmedSubject,
      body: trimmedBody,
      recipient_group: group,
      course_id: group === "kurs_teilnehmer" ? courseId : null,
      recipient_count: recipientIds.length,
      sent_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !send) {
    return { error: "Versand konnte nicht gespeichert werden" };
  }

  // Bulk-enqueue only (no inline dispatch) so this doesn't block on N sends —
  // the existing cron drain picks these up, same pattern as the SEPA collection run.
  await Promise.all(
    recipientIds.map((customerId) =>
      enqueueNotification({
        customerId,
        eventType: "newsletter",
        payload: { send_id: send.id },
        dedupeKey: `newsletter:${send.id}:${customerId}`,
      })
    )
  );

  revalidatePath("/admin/newsletter");
  return { success: true, recipientCount: recipientIds.length };
}
