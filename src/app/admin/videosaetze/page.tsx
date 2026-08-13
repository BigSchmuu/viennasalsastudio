import { createClient } from "@/lib/supabase/server";
import { VideoSetManager, type VideoSetRow } from "@/components/admin/video-sets/video-set-manager";

export default async function VideoSetsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("video_sets")
    .select("id, name, level, video_set_lessons(count)")
    .order("created_at", { ascending: true });

  const videoSets: VideoSetRow[] = (data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    level: v.level,
    lessonCount: v.video_set_lessons[0]?.count ?? 0,
  }));

  return <VideoSetManager videoSets={videoSets} />;
}
