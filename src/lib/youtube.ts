/** Extracts the video ID from common YouTube URL formats (watch, youtu.be, embed, shorts). */
export function getYoutubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      const embedMatch = parsed.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
      if (embedMatch) {
        return embedMatch[2];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Converts a YouTube URL into an embeddable player URL, or null if it isn't a recognizable YouTube URL. */
export function getYoutubeEmbedUrl(url: string): string | null {
  const videoId = getYoutubeVideoId(url);
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}
