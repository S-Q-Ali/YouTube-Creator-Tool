import { describe, it, expect } from "vitest";
import { channelAverageViews, outlierPercent, MIN_USABLE_VIDEOS } from "../outlier";

describe("channelAverageViews", () => {
  it("splits lifetime views across the channel's videos", () => {
    expect(channelAverageViews({ viewCount: 1_000_000, videoCount: 100 })).toBe(10_000);
  });

  it("keeps fractional averages so the ratio does not lose precision", () => {
    expect(channelAverageViews({ viewCount: 1_000_000, videoCount: 300 })).toBeCloseTo(3333.33, 2);
  });

  it("returns null for a channel with too few videos to average", () => {
    expect(channelAverageViews({ viewCount: 900, videoCount: MIN_USABLE_VIDEOS - 1 })).toBeNull();
  });

  it("returns null at exactly the usable threshold boundary only when counts are unusable", () => {
    expect(channelAverageViews({ viewCount: 900, videoCount: MIN_USABLE_VIDEOS })).toBe(300);
  });

  it("returns null for missing, zero or negative statistics", () => {
    expect(channelAverageViews(null)).toBeNull();
    expect(channelAverageViews(undefined)).toBeNull();
    expect(channelAverageViews({ viewCount: null, videoCount: 100 })).toBeNull();
    expect(channelAverageViews({ viewCount: 1_000, videoCount: null })).toBeNull();
    expect(channelAverageViews({ viewCount: 0, videoCount: 100 })).toBeNull();
    expect(channelAverageViews({ viewCount: -5, videoCount: 100 })).toBeNull();
  });

  it("returns null for NaN so a bad row never poisons a page", () => {
    expect(channelAverageViews({ viewCount: Number.NaN, videoCount: 100 })).toBeNull();
  });
});

describe("outlierPercent", () => {
  it("is 100 for a video exactly on the channel average", () => {
    expect(outlierPercent(10_000, 10_000)).toBe(100);
  });

  it("scales above and below the average", () => {
    expect(outlierPercent(50_000, 10_000)).toBe(500);
    expect(outlierPercent(5_000, 10_000)).toBe(50);
  });

  it("rounds to a whole percent", () => {
    expect(outlierPercent(7, 3)).toBe(233);
  });

  it("is null when either side is missing or unusable", () => {
    expect(outlierPercent(null, 10_000)).toBeNull();
    expect(outlierPercent(10_000, null)).toBeNull();
    expect(outlierPercent(0, 10_000)).toBeNull();
    expect(outlierPercent(10_000, 0)).toBeNull();
    expect(outlierPercent(-1, 10_000)).toBeNull();
    expect(outlierPercent(10_000, -1)).toBeNull();
  });

  it("is null for NaN rather than reporting a fake outlier", () => {
    expect(outlierPercent(Number.NaN, 10_000)).toBeNull();
    expect(outlierPercent(10_000, Number.NaN)).toBeNull();
  });
});
