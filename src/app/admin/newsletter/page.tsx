import { createClient } from "@/lib/supabase/server";
import { NewsletterComposer, type CourseOption } from "@/components/admin/newsletter/newsletter-composer";
import { NewsletterHistoryList, type NewsletterHistoryRow } from "@/components/admin/newsletter/newsletter-history-list";
import type { NewsletterGroup } from "@/lib/newsletter/recipients";

export default async function NewsletterPage() {
  const supabase = await createClient();

  const [coursesRes, sendsRes] = await Promise.all([
    supabase.from("courses").select("id, name").order("name", { ascending: true }),
    supabase
      .from("newsletter_sends")
      .select("id, subject, sent_at, recipient_group, recipient_count, courses(name)")
      .order("sent_at", { ascending: false }),
  ]);

  const courses: CourseOption[] = coursesRes.data ?? [];

  const history: NewsletterHistoryRow[] = (sendsRes.data ?? []).map((send) => ({
    id: send.id,
    subject: send.subject,
    sentAt: send.sent_at,
    recipientGroup: send.recipient_group as NewsletterGroup,
    courseName: send.courses?.name ?? null,
    recipientCount: send.recipient_count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Newsletter</h2>
        <p className="text-sm text-muted-foreground">E-Mail an eine Empfängergruppe verschicken</p>
      </div>

      <NewsletterComposer courses={courses} />

      <NewsletterHistoryList rows={history} />
    </div>
  );
}
