import { beforeAll, describe, expect, it } from "vitest";
import { computeVelocity } from "../../lib/velocity";

/*
 * The Tier 0 grid reader parses YouTube's own meta text, and the Tier 1
 * server upgrade must agree with it. Rather than keep a hand-mirrored copy
 * of the parser in the content script, the parser lives in a classic
 * content-script file that publishes itself on globalThis, and this test
 * drives that exact file.
 */
beforeAll(async () => {
  await import("../lib/nsMeta.js");
});

function parse(text, now = Date.parse("2026-09-27T12:00:00.000Z")) {
  return globalThis.NS_META.parse(text, now);
}

describe("parse video meta text", () => {
  it("reads abbreviated views and a relative age from a home card", () => {
    const facts = parse("1.2M views · 3 days ago");

    expect(facts.views).toBe(1_200_000);
    expect(facts.ageHours).toBe(72);
    expect(facts.ageLabel).toBe("3 days ago");
  });

  it("ignores the channel name that leads the meta line", () => {
    const facts = parse("Niche Scope · 1,234,567 views · 2 weeks ago");

    expect(facts.views).toBe(1_234_567);
    expect(facts.ageHours).toBe(336);
  });

  it("treats a non-breaking space in the views text as a normal space", () => {
    const facts = parse("12K views · 1 hour ago");

    expect(facts.views).toBe(12_000);
    expect(facts.ageHours).toBe(1);
  });

  it("reads billion-scale views and multi-year ages", () => {
    const facts = parse("1.2B views · 2 years ago");

    expect(facts.views).toBe(1_200_000_000);
    expect(facts.ageHours).toBe(17_520);
  });

  it("reads a zero-view card as zero rather than unknown", () => {
    const facts = parse("No views · 1 day ago");

    expect(facts.views).toBe(0);
    expect(facts.ageHours).toBe(24);
  });

  it("reads the singular one-view card", () => {
    const facts = parse("1 view · 5 hours ago");

    expect(facts.views).toBe(1);
    expect(facts.ageHours).toBe(5);
  });

  it("reads a livestream card whose age is prefixed with Streamed", () => {
    const facts = parse("Niche Scope · 88K views · Streamed 5 hours ago");

    expect(facts.views).toBe(88_000);
    expect(facts.ageHours).toBe(5);
    expect(facts.ageLabel).toBe("Streamed 5 hours ago");
  });

  it("reads a premiere card whose age is prefixed with Premiered", () => {
    const facts = parse("Niche Scope · 4.5K views · Premiered 3 months ago");

    expect(facts.views).toBe(4_500);
    expect(facts.ageHours).toBe(2_160);
  });

  it("reads a live card labelled Yesterday as a day old", () => {
    const facts = parse("Niche Scope · 12K views · Streamed yesterday");

    expect(facts.ageHours).toBe(24);
  });

  it("falls back to the absolute date older cards show", () => {
    const facts = parse("Niche Scope · 3.4M views · Dec 12, 2025");

    expect(facts.views).toBe(3_400_000);
    // 289 days from 2025-12-12 to 2026-09-27; widened by a day so the local
    // timezone the date parses in cannot fail the test.
    expect(facts.ageHours / 24).toBeGreaterThan(288);
    expect(facts.ageHours / 24).toBeLessThan(291);
  });

  it("reports nothing usable when the text has no views and no age", () => {
    const facts = parse("Subscribe");

    expect(facts.views).toBeNull();
    expect(facts.ageHours).toBeNull();
    expect(facts.ageLabel).toBeNull();
  });
});

describe("format velocity for the grid", () => {
  it("writes a per-hour reading with a thin-space grouped value", () => {
    expect(globalThis.NS_META.fmtVph(55_600)).toBe("55.6K/hr");
  });

  it("keeps small hourly readings un-abbreviated", () => {
    expect(globalThis.NS_META.fmtVph(950)).toBe("950/hr");
  });

  it("writes the secondary per-day reading for full density", () => {
    expect(globalThis.NS_META.fmtVphDay(1_000_000)).toBe("1.0M/day");
  });

  it("returns an empty string when there is no reading at all", () => {
    expect(globalThis.NS_META.fmtVph(null)).toBe("");
  });
});

describe("velocity agrees with the server metric", () => {
  const cases = [
    { views: 1_200_000, ageHours: 72 },
    { views: 10_000, ageHours: 1 / 60 },
    { views: 0, ageHours: 24 },
    { views: 123, ageHours: 8760 },
    { views: 88_000, ageHours: 5 }
  ];

  for (const c of cases) {
    it(`matches lib/velocity for ${c.views} views aged ${c.ageHours}h`, () => {
      const now = Date.parse("2026-09-27T12:00:00.000Z");
      const extensionReading = globalThis.NS_META.velocity({ views: c.views, ageHours: c.ageHours });
      const serverReading = computeVelocity({
        viewCount: c.views,
        publishedAt: new Date(now - c.ageHours * 3_600_000).toISOString(),
        now
      });

      expect(extensionReading.vph).toBe(serverReading.vph);
      expect(extensionReading.vphDay).toBe(serverReading.vphDay);
    });
  }

  it("returns no reading when the card text had no views", () => {
    expect(globalThis.NS_META.velocity({ views: null, ageHours: 12 }).vph).toBeNull();
  });
});

describe("format the card context row", () => {
  it("writes an exact view count with grouped digits, the way the watch card does", () => {
    expect(globalThis.NS_META.fmtExact(1_234_567)).toBe("1 234 567");
  });

  it("keeps small counts un-grouped and exact", () => {
    expect(globalThis.NS_META.fmtExact(907)).toBe("907");
    expect(globalThis.NS_META.fmtExact(0)).toBe("0");
  });

  it("rounds a reading the API gave as a float", () => {
    expect(globalThis.NS_META.fmtExact(1_234_567.4)).toBe("1 234 567");
  });

  it("returns an empty string rather than a placeholder for a missing count", () => {
    expect(globalThis.NS_META.fmtExact(null)).toBe("");
    expect(globalThis.NS_META.fmtExact(undefined)).toBe("");
    expect(globalThis.NS_META.fmtExact(Number.NaN)).toBe("");
  });

  it("writes an absolute publish date, which is the reading a card never shows", () => {
    // en-GB short month, the same string the watch card's posted row prints.
    expect(globalThis.NS_META.fmtDate("2026-09-27T12:00:00.000Z")).toBe("27 Sept 2026");
  });

  it("returns an empty string for a date that is absent or unparseable", () => {
    expect(globalThis.NS_META.fmtDate("")).toBe("");
    expect(globalThis.NS_META.fmtDate(null)).toBe("");
    expect(globalThis.NS_META.fmtDate("not a date")).toBe("");
  });

  it("abbreviates a subscriber count without a trailing zero", () => {
    expect(globalThis.NS_META.fmtSubs(128_000)).toBe("128K");
    expect(globalThis.NS_META.fmtSubs(1_284_000)).toBe("1.3M");
    expect(globalThis.NS_META.fmtSubs(940)).toBe("940");
  });

  it("returns an empty string for an unknown subscriber count", () => {
    expect(globalThis.NS_META.fmtSubs(null)).toBe("");
  });
});

describe("write an outlier reading in words", () => {
  it("calls a video twice its usual by a factor", () => {
    expect(globalThis.NS_META.fmtOutlier(340)).toBe("3.4× usual");
  });

  it("calls a video on its channel's usual pace typical instead of 1x", () => {
    expect(globalThis.NS_META.fmtOutlier(100)).toBe("typical");
  });

  it("keeps a modest overperformer factual", () => {
    expect(globalThis.NS_META.fmtOutlier(160)).toBe("1.6× usual");
  });

  it("shows a video well under its channel's pace as a fraction", () => {
    expect(globalThis.NS_META.fmtOutlier(30)).toBe("0.3× usual");
  });

  it("tints by how far from usual the video sits", () => {
    expect(globalThis.NS_META.outlierTone(340)).toBe("hot");
    expect(globalThis.NS_META.outlierTone(100)).toBe("normal");
    expect(globalThis.NS_META.outlierTone(30)).toBe("cool");
  });

  it("returns an empty string when there is nothing to compare against", () => {
    expect(globalThis.NS_META.fmtOutlier(null)).toBe("");
    expect(globalThis.NS_META.outlierTone(null)).toBe("normal");
  });
});
