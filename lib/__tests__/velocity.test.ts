import { describe, expect, it } from "vitest";
import { computeVelocity } from "../velocity";

const NOW = Date.parse("2026-09-27T12:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("computeVelocity", () => {
  it("reports views per hour since publish for a two-day-old video", () => {
    const result = computeVelocity({
      viewCount: 48_000,
      publishedAt: "2026-09-25T12:00:00.000Z",
      now: NOW,
    });

    expect(result.vph).toBe(1000);
    expect(result.vphDay).toBe(24_000);
    expect(result.ageHours).toBe(48);
    expect(result.basis).toBe("lifetime");
  });

  it("reports the same rate per day as the hourly rate times 24", () => {
    const result = computeVelocity({
      viewCount: 123_456,
      publishedAt: "2026-09-20T12:00:00.000Z",
      now: NOW,
    });

    expect(result.vphDay).toBe(Math.round(result.vph! * 24 * 10) / 10);
  });

  it("floors the age at one hour so brand-new videos never divide by nearly zero", () => {
    const result = computeVelocity({
      viewCount: 10_000,
      publishedAt: new Date(NOW - 10 * 60_000).toISOString(),
      now: NOW,
    });

    expect(result.ageHours).toBe(1);
    expect(result.vph).toBe(10_000);
  });

  it("treats a future publish date as one hour old instead of going negative", () => {
    const result = computeVelocity({
      viewCount: 5_000,
      publishedAt: "2026-09-30T12:00:00.000Z",
      now: NOW,
    });

    expect(result.ageHours).toBe(1);
    expect(result.vph).toBe(5_000);
  });

  it("rounds readings to one decimal so the display stays stable", () => {
    const result = computeVelocity({
      viewCount: 1000,
      publishedAt: "2026-09-26T00:00:00.000Z",
      now: NOW,
    });

    expect(result.vph).toBe(27.8);
    expect(result.vphDay).toBe(667.2);
  });

  it("returns no reading when the view count is unknown", () => {
    const result = computeVelocity({
      viewCount: null,
      publishedAt: "2026-09-25T12:00:00.000Z",
      now: NOW,
    });

    expect(result).toEqual({ vph: null, vphDay: null, ageHours: 0, basis: "none" });
  });

  it("returns no reading when the publish date is missing or unparseable", () => {
    const missing = computeVelocity({ viewCount: 900, publishedAt: null, now: NOW });
    const garbage = computeVelocity({ viewCount: 900, publishedAt: "yesterday", now: NOW });

    expect(missing.basis).toBe("none");
    expect(garbage.basis).toBe("none");
  });

  it("returns no reading for zero views, which carries no momentum signal", () => {
    const result = computeVelocity({
      viewCount: 0,
      publishedAt: "2026-09-25T12:00:00.000Z",
      now: NOW,
    });

    expect(result.vph).toBe(0);
    expect(result.basis).toBe("lifetime");
  });
});
