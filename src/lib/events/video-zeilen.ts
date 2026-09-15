import type { EventVideo } from "@/lib/events/medien";

/** Die Videospalten, die eine Seite mitlädt (PROJ-55). */
export const VIDEO_SPALTEN = "event_videos(id, youtube_id, title, position)";

export type VideoZeile = {
  id: string;
  youtube_id: string;
  title: string | null;
  position: number;
};

/** Die Videos in ihrer Reihenfolge — eine Tür für Eventseite und Serienseite. */
export function videosAus(zeilen: VideoZeile[] | null): EventVideo[] {
  return (zeilen ?? [])
    .sort((a, b) => a.position - b.position)
    .map((zeile) => ({ id: zeile.id, youtubeId: zeile.youtube_id, titel: zeile.title }));
}
