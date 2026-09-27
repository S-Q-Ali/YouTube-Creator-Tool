import { describe, expect, it } from "vitest";
import { buildGridRow } from "../gridRows";
import { scoreLabel } from "../scorecard";
import type { VideoInfo } from "../types";

const NOW = Date.parse("2026-09-27T12:00:00.000Z");

function makeVideo(overrides: Partial<VideoInfo> = {}): VideoInfo {
  return {
    videoId: "dQw4w9WgXcQ",
    channelId: "UC1234567890",
    title: "How to switch from watching to creating",
    description: "A practical walkthrough with chapters and resources listed below.",
    publishedAt: "2026-09-25T12:00:00.000Z",
    durationSeconds: 222,
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg",
    tags: ["youtube growth", "creator economy", "channel growth"],
    categoryId: "22",
    defaultLanguage: "en",
    viewCount: 48_000,
    likeCount: 2_100,
    commentCount: 90,
    lastFetched: NOW,
    ...overrides
  };
}

describe("buildGridRow", () => {
  it("carries the readings a grid cell needs, nothing else", () => {
    const row = buildGridRow(makeVideo({ viewCount: 12_000 }), NOW);

    expect(row).toMatchObject({
      id: "dQw4w9WgXcQ",
      viewCount: 12_000,
      likeCount: 2_100,
      durationSeconds: 222,
      publishedAt: "2026-09-25T12:00:00.000Z"
    });
    expect(row.velocity.vph).toBe(250);
    expect(row.velocity.vphDay).toBe(6_000);
    expect(row.spike).toBe(false);
  });

  it("derives the grade from the same score the watch card shows", () => {
    const row = buildGridRow(makeVideo(), NOW);

    expect(row.score).toBeGreaterThanOrEqual(0);
    expect(row.score).toBeLessThanOrEqual(100);
    expect(row.grade).toBe(scoreLabel(row.score));
  });

  it("flags a video holding 500 views an hour or more as spiking", () => {
    const row = buildGridRow(makeVideo({ viewCount: 24_000 }), NOW);

    expect(row.velocity.vph).toBe(500);
    expect(row.spike).toBe(true);
  });

  it("does not flag a video just below the spike threshold", () => {
    const row = buildGridRow(makeVideo({ viewCount: 23_940 }), NOW);

    expect(row.velocity.vph).toBe(498.8);
    expect(row.spike).toBe(false);
  });

  it("reports no duration when YouTube gave none", () => {
    const row = buildGridRow(makeVideo({ durationSeconds: 0 }), NOW);

    expect(row.durationSeconds).toBeNull();
  });

  it("reports no velocity for a video with no publish date", () => {
    const row = buildGridRow(makeVideo({ publishedAt: "" }), NOW);

    expect(row.velocity.vph).toBeNull();
    expect(row.spike).toBe(false);
  });

  it("keeps a null like count as null rather than zero", () => {
    const row = buildGridRow(makeVideo({ likeCount: null }), NOW);

    expect(row.likeCount).toBeNull();
  });

  it("adds the channel readings when a channel is supplied", () => {
    const row = buildGridRow(makeVideo({ viewCount: 480_000 }), NOW, { subscriberCount: 128_000, averageViews: 12_000 });

    expect(row.subscribers).toBe(128_000);
    expect(row.outlier).toBe(4000);
  });

  it("leaves channel readings null when the page had no channel data", () => {
    const row = buildGridRow(makeVideo(), NOW);

    expect(row.subscribers).toBeNull();
    expect(row.outlier).toBeNull();
  });

  it("keeps subscribers even when the average is too thin to compare against", () => {
    const row = buildGridRow(makeVideo(), NOW, { subscriberCount: 900, averageViews: null });

    expect(row.subscribers).toBe(900);
    expect(row.outlier).toBeNull();
  });

  it("treats a zero or missing subscriber count as unknown", () => {
    expect(buildGridRow(makeVideo(), NOW, { subscriberCount: 0, averageViews: 1 }).subscribers).toBeNull();
    expect(buildGridRow(makeVideo(), NOW, { subscriberCount: null, averageViews: 1 }).subscribers).toBeNull();
  });

  it("carries the thumbnail url so a card can offer the image without another request", () => {
    const row = buildGridRow(makeVideo(), NOW);

    expect(row.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg");
  });
});
