import { describe, expect, it } from "vitest";
import { computeDemand, competitionFromViews, overallScore, competitionLabel } from "../keywordEngine";
import { parseVideoInput, parseChannelInput, parseDuration } from "../youtubeClient";

describe("computeDemand", () => {
  it("ranks earlier autocomplete suggestions higher", () => {
    const early = computeDemand([{ rank: 0, count: 1 }]);
    const late = computeDemand([{ rank: 14, count: 1 }]);
    expect(early).toBeGreaterThan(late);
  });

  it("clamps to 0-100", () => {
    expect(computeDemand([{ rank: 99, count: 1 }])).toBeGreaterThanOrEqual(0);
    expect(computeDemand([{ rank: 0, count: 1 }])).toBeLessThanOrEqual(100);
  });

  it("boosts terms that appear across many branches", () => {
    const single = computeDemand([{ rank: 3, count: 1 }]);
    const multi = computeDemand([{ rank: 3, count: 1 }, { rank: 3, count: 1 }]);
    expect(multi).toBeGreaterThan(single);
  });
});

describe("competitionFromViews", () => {
  it("returns Low for a sparse result set", () => {
    expect(competitionFromViews([]).label).toBe("Low");
    expect(competitionFromViews([1000, 2000]).score).toBeLessThan(33);
  });

  it("returns High when top results are very strong", () => {
    const views = Array.from({ length: 20 }, (_, i) => 5_000_000 + i * 1_000_000);
    const { label, score } = competitionFromViews(views);
    expect(label).toBe("High");
    expect(score).toBeGreaterThan(66);
  });

  it("labels by score thresholds", () => {
    expect(competitionLabel(10)).toBe("Low");
    expect(competitionLabel(50)).toBe("Medium");
    expect(competitionLabel(90)).toBe("High");
  });
});

describe("overallScore", () => {
  it("rewards high demand + low competition", () => {
    const good = overallScore(80, 20);
    const bad = overallScore(80, 80);
    expect(good).toBeGreaterThan(bad);
    expect(good).toBe(64);
  });
});

describe("input parsing", () => {
  it("parses video URLs and bare ids", () => {
    expect(parseVideoInput("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("not a video")).toBeNull();
  });

  it("parses channel handles and ids", () => {
    expect(parseChannelInput("https://www.youtube.com/@marquesbrownlee")).toEqual({ type: "handle", value: "marquesbrownlee" });
    expect(parseChannelInput("UCBJycsmduvYEL83R_U4JriQ")).toEqual({ type: "id", value: "UCBJycsmduvYEL83R_U4JriQ" });
    expect(parseChannelInput("youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ")).toEqual({ type: "id", value: "UCBJycsmduvYEL83R_U4JriQ" });
    expect(parseChannelInput("bad input")).toBeNull();
  });

  it("parses ISO durations", () => {
    expect(parseDuration("PT45S")).toBe(45);
    expect(parseDuration("PT1H2M3S")).toBe(3723);
    expect(parseDuration(undefined)).toBe(0);
  });
});
