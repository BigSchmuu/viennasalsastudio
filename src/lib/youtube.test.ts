import { describe, it, expect } from "vitest";
import { getYoutubeVideoId, getYoutubeEmbedUrl } from "./youtube";

describe("getYoutubeVideoId", () => {
  it("extracts the ID from a standard watch URL", () => {
    expect(getYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the ID from a watch URL without www", () => {
    expect(getYoutubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the ID from a youtu.be short URL", () => {
    expect(getYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the ID from an embed URL", () => {
    expect(getYoutubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the ID from a shorts URL", () => {
    expect(getYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the ID from an m.youtube.com URL", () => {
    expect(getYoutubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a non-YouTube URL", () => {
    expect(getYoutubeVideoId("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null for a javascript: URL", () => {
    expect(getYoutubeVideoId("javascript:alert(1)")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(getYoutubeVideoId("not-a-url")).toBeNull();
  });

  it("returns null for a YouTube URL with no video ID", () => {
    expect(getYoutubeVideoId("https://www.youtube.com/")).toBeNull();
  });
});

describe("getYoutubeEmbedUrl", () => {
  it("builds a youtube-nocookie.com embed URL for a valid watch URL", () => {
    expect(getYoutubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });

  it("returns null for a non-YouTube URL so nothing gets embedded", () => {
    expect(getYoutubeEmbedUrl("https://evil.example.com/tracker")).toBeNull();
  });

  it("returns null for a javascript: URL so it can never become an iframe src", () => {
    expect(getYoutubeEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
