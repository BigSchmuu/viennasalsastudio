import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LessonManager, type LessonRow } from "@/components/admin/video-sets/lesson-manager";
import { Button } from "@/components/ui/button";

export default async function VideoSetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: videoSet } = await supabase
    .from("video_sets")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!videoSet) {
    notFound();
  }

  const { data: lessonsData } = await supabase
    .from("video_set_lessons")
    .select("id, title, customer_video_url, video_set_lesson_videos(url, position)")
    .eq("video_set_id", id)
    .order("position", { ascending: true });

  const lessons: LessonRow[] = (lessonsData ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    videoUrls: [...l.video_set_lesson_videos]
      .sort((a, b) => a.position - b.position)
      .map((v) => v.url),
    customerVideoUrl: l.customer_video_url,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Button variant="link" className="px-0" asChild>
          <Link href="/admin/videosaetze">← Zurück zu Videosätzen</Link>
        </Button>
        <h2 className="font-heading text-xl font-bold">{videoSet.name}</h2>
        <p className="text-sm text-muted-foreground">Lektionen verwalten</p>
      </div>
      <LessonManager videoSetId={id} lessons={lessons} />
    </div>
  );
}
