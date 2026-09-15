import { useTranslations } from "next-intl";
import { YoutubeEmbed } from "@/components/video/youtube-embed";
import type { EventVideo } from "@/lib/events/medien";

/**
 * Die Videos eines Events oder einer Serie (PROJ-55).
 *
 * Eingebettet wie die Beispiel-Videos aus PROJ-11: über youtube-nocookie, und
 * durch dieselbe Komponente — eine zweite Einbettung müsste dieselbe
 * Datensparsamkeit ein zweites Mal richtig hinbekommen.
 */
export function EventVideos({ videos, eventName }: { videos: EventVideo[]; eventName: string }) {
  const t = useTranslations("events");
  if (videos.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border/60 pt-6">
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("videosHeading")}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {videos.map((video) => (
          <YoutubeEmbed
            key={video.id}
            url={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            title={video.titel ?? eventName}
          />
        ))}
      </div>
    </section>
  );
}
