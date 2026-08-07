import { describe, expect, it } from "vitest";
import { computeSeoScore, computeChannelSeoScore, scoreLabel, seoCheckSections } from "../scorecard";

const fullVideo = {
  title: "How to Grow Tomatoes at Home: The Complete Beginner Guide",
  description:
    "Learn how to grow tomatoes at home step by step. This complete beginner guide covers everything from choosing the right tomato variety and preparing your soil, to planting, watering, pruning, staking, and harvesting your tomatoes. We show you how to grow tomatoes in containers, raised beds, or in the ground, and how to deal with common problems like blossom end rot, aphids, and blight. Whether you are growing tomatoes for the first time or you want bigger, better yields, this guide to growing tomatoes indoors and outdoors has the tips you need. Watch to the end for our full tomato growing calendar and my top 10 mistakes new gardeners make.",
  tags: ["tomato", "gardening", "tomatoes", "how to grow tomatoes", "garden", "vegetable garden", "growing tomatoes"],
  viewCount: 250_000,
  likeCount: 12_000,
  commentCount: 1_400,
  publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  focusKeyword: "how to grow tomatoes",
};

describe("computeSeoScore", () => {
  it("scores a fully-optimized video highly", () => {
    const r = computeSeoScore(fullVideo);
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it("weights actionable and performance 50/50", () => {
    const r = computeSeoScore(fullVideo);
    expect(r.actionablePct).toBeGreaterThanOrEqual(95);
    expect(r.performancePct).toBeGreaterThanOrEqual(90);
    expect(Math.abs(r.actionablePct - r.performancePct)).toBeLessThanOrEqual(10);
  });

  it("penalizes a weak title and description", () => {
    const r = computeSeoScore({ ...fullVideo, title: "video", description: "", tags: [] });
    const title = r.checks.find((c) => c.id === "titleLength");
    const desc = r.checks.find((c) => c.id === "descriptionLength");
    expect(title?.passed).toBe(false);
    expect(desc?.passed).toBe(false);
  });

  it("detects keyword usage across title, description and tags", () => {
    const r = computeSeoScore(fullVideo);
    const kwTitle = r.checks.find((c) => c.id === "keywordTitle");
    const kwDesc = r.checks.find((c) => c.id === "keywordDescription");
    const kwTags = r.checks.find((c) => c.id === "keywordTags");
    expect(kwTitle?.passed).toBe(true);
    expect(kwDesc?.passed).toBe(true);
    expect(kwTags?.passed).toBe(true);
  });

  it("scores performance from engagement and velocity", () => {
    const engaged = computeSeoScore(fullVideo);
    const flat = computeSeoScore({
      ...fullVideo,
      viewCount: 50_000,
      likeCount: 200,
      commentCount: 10,
      publishedAt: new Date().toISOString(),
    });
    expect(flat.performancePct).toBeLessThan(engaged.performancePct);
  });
});

describe("scoreLabel", () => {
  it("maps 0-100 to A/B/C/D/E/F labels", () => {
    expect(scoreLabel(95)).toBe("A");
    expect(scoreLabel(82)).toBe("B");
    expect(scoreLabel(70)).toBe("C");
    expect(scoreLabel(55)).toBe("D");
    expect(scoreLabel(40)).toBe("E");
    expect(scoreLabel(20)).toBe("F");
  });
});

describe("computeChannelSeoScore", () => {
  it("scores a well-set-up channel", () => {
    const r = computeChannelSeoScore({
      channelId: "UCtest",
      title: "GardenGrow Academy — Vegetable Gardening for Beginners",
      description:
        "Weekly videos about vegetable gardening, organic soil, permaculture and growing food at home. Subscribe for beginner-friendly gardening tutorials.",
      thumbnailUrl: "",
      subscriberCount: 50_000,
      videoCount: 120,
      viewCount: 8_000_000,
      channelTags: ["gardening", "vegetable garden", "organic farming", "permaculture", "home garden"],
    });
    expect(r.checks.length).toBeGreaterThan(0);
    expect(r.checks.every((c) => typeof c.score === "number")).toBe(true);
  });
});

describe("seoCheckSections", () => {
  it("splits checks into actionable and performance", () => {
    const r = computeSeoScore(fullVideo);
    const sections = seoCheckSections(r.checks);
    expect(sections.actionable.length).toBeGreaterThan(0);
    expect(sections.performance.length).toBeGreaterThan(0);
  });
});
