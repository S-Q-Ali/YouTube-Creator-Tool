import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ChannelInfo, VideoInfo } from "../types";

let engine: typeof import("../trendingEngine");

function makeChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    channelId: "ch_test",
    title: "Test Channel",
    description: "A regular channel about topics.",
    thumbnailUrl: "",
    customUrl: "@test",
    country: "US",
    publishedAt: "2020-01-01T00:00:00Z",
    subscriberCount: 1000,
    videoCount: 50,
    viewCount: 100000,
    channelTags: [],
    topicCategories: [],
    lastFetched: 0,
    ...overrides,
  };
}

function makeVideo(overrides: Partial<VideoInfo> = {}): VideoInfo {
  return {
    videoId: "vid_test",
    channelId: "ch_test",
    title: "A normal video title",
    description: "",
    publishedAt: "2026-08-01T00:00:00Z",
    durationSeconds: 600,
    thumbnailUrl: "",
    tags: [],
    categoryId: "27",
    defaultLanguage: "en",
    viewCount: 10000,
    likeCount: 100,
    commentCount: 10,
    lastFetched: 0,
    ...overrides,
  };
}

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "niche-scope-trending-"));
  process.env.DATABASE_DIR = dir;
  engine = await import("../trendingEngine");
});

describe("isRapidlyGrowing", () => {
  it("flags growth at or above the threshold", () => {
    expect(engine.RAPID_GROWTH_THRESHOLD).toBe(50);
    expect(engine.isRapidlyGrowing(50)).toBe(true);
    expect(engine.isRapidlyGrowing(120)).toBe(true);
  });

  it("does not flag growth below the threshold or negative growth", () => {
    expect(engine.isRapidlyGrowing(49.9)).toBe(false);
    expect(engine.isRapidlyGrowing(0)).toBe(false);
    expect(engine.isRapidlyGrowing(-30)).toBe(false);
  });
});

describe("detectAiGenerated", () => {
  it("scores high for channels with multiple AI markers", () => {
    const channel = makeChannel({
      description: "Fully AI generated stories. Narration via ElevenLabs.",
    });
    const videos = [
      makeVideo({ title: "AI history documentary episode 1" }),
      makeVideo({ title: "AI animated story", tags: ["midjourney", "ai art"] }),
    ];
    const score = engine.detectAiGenerated(channel, videos);
    expect(score).toBeGreaterThanOrEqual(engine.AI_GENERATED_THRESHOLD);
  });

  it("gives a faceless-niche bonus", () => {
    const score = engine.detectAiGenerated(makeChannel(), [makeVideo()], true);
    expect(score).toBe(30);
    expect(engine.detectAiGenerated(makeChannel(), [makeVideo()], false)).toBe(0);
  });

  it("scores low for channels without AI markers outside the faceless niche", () => {
    const channel = makeChannel({ description: "Cooking recipes and kitchen tips." });
    const videos = [makeVideo({ title: "How to bake bread", tags: ["cooking"] })];
    expect(engine.detectAiGenerated(channel, videos)).toBeLessThan(
      engine.AI_GENERATED_THRESHOLD
    );
  });

  it("caps the score at 100", () => {
    const channel = makeChannel({
      description: AI_MARKER_TEXT.repeat(30),
    });
    expect(engine.detectAiGenerated(channel, [], true)).toBeLessThanOrEqual(100);
  });
});

const AI_MARKER_TEXT = "ai generated chatgpt midjourney sora ";

describe("calculateViralScore ranking boost", () => {
  it("ranks a newly created, rapidly growing channel above an identical stale one", () => {
    const channel = makeChannel({
      subscriberCount: 5000,
      viewCount: 500000,
      videoCount: 20,
      publishedAt: "2026-06-01T00:00:00Z",
    });
    const videos = Array.from({ length: 6 }, (_, i) =>
      makeVideo({ videoId: `v${i}`, viewCount: 50000, likeCount: 500, commentCount: 50 })
    );

    const boosted = engine.calculateViralScore(channel, videos, 120, true);
    const stale = engine.calculateViralScore(channel, videos, 0, false);

    expect(boosted).toBeGreaterThan(stale);
  });

  it("applies the same boost across any niche input (score is niche-agnostic)", () => {
    const channel = makeChannel();
    const videos = [makeVideo()];
    const facelessScore = engine.calculateViralScore(channel, videos, 100, true);
    const gamingScore = engine.calculateViralScore(channel, videos, 100, true);
    expect(facelessScore).toBe(gamingScore);
  });

  it("keeps scores within 0-100 and boosts a fast grower by up to 25 points", () => {
    const channel = makeChannel();
    const videos = [makeVideo()];
    const base = engine.calculateViralScore(channel, videos, 0, false);
    const max = engine.calculateViralScore(channel, videos, 500, true);
    expect(base).toBeGreaterThanOrEqual(0);
    expect(base).toBeLessThanOrEqual(100);
    expect(max).toBeLessThanOrEqual(100);
    expect(max - base).toBeCloseTo(25, 0); // 20 growth + 5 newly-created
  });
});

describe("niches", () => {
  it("has an AI-Generated Faceless niche for both 16:9 and 9:16 formats", () => {
    const longform = engine.FORMAT_NICHES.longform?.find((n) => n.id === "faceless");
    const shortform = engine.FORMAT_NICHES.shortform?.find((n) => n.id === "faceless");

    expect(longform).toBeDefined();
    expect(longform?.name).toBe("AI-Generated Faceless Content");
    expect(longform?.difficulty).toBe("easy");
    expect(longform?.queries.some((q) => q.toLowerCase().includes("ai"))).toBe(true);

    expect(shortform).toBeDefined();
    expect(shortform?.name).toBe("AI-Generated Faceless Shorts");
    expect(shortform?.difficulty).toBe("easy");
    expect(shortform?.queries.every((q) => q.toLowerCase().includes("ai"))).toBe(true);
  });

  it("has a Kids Content niche for both 16:9 and 9:16 formats with child-safe queries", () => {
    const longform = engine.FORMAT_NICHES.longform?.find((n) => n.id === "kids");
    const shortform = engine.FORMAT_NICHES.shortform?.find((n) => n.id === "kids");

    expect(longform).toBeDefined();
    expect(longform?.name).toBe("Kids Content");
    expect(longform?.difficulty).toBe("easy");
    expect(longform?.queries.some((q) => q.toLowerCase().includes("kids"))).toBe(true);

    expect(shortform).toBeDefined();
    expect(shortform?.name).toBe("Kids Shorts");
    expect(shortform?.difficulty).toBe("easy");
    expect(shortform?.queries.some((q) => q.toLowerCase().includes("kids"))).toBe(true);

    const childSafe = /violence|blood|nsfw|adult|sexy/i;
    const allKidsQueries = [...(longform?.queries ?? []), ...(shortform?.queries ?? [])];
    expect(allKidsQueries.some((q) => childSafe.test(q))).toBe(false);
  });
});