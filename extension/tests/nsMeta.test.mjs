import { beforeAll, describe, expect, it } from "vitest";

/*
 * The formatters behind both surfaces that print our numbers. Each one is pinned
 * to the exact string a card or a watch page will show, because a formatter that
 * drifts is a number the user cannot trust twice.
 *
 * The reader that used to guess a card's views and age off YouTube's own meta
 * text is gone with the instant grid reading it fed: the strip waits for the
 * server instead, and lib/velocity.ts is now the only velocity implementation.
 */
beforeAll(async () => {
  await import("../lib/nsMeta.js");
});

describe("format velocity", () => {
  it("writes a per-hour reading with an abbreviated value", () => {
    expect(globalThis.NS_META.fmtVph(55_600)).toBe("55.6K/hr");
  });

  it("keeps small hourly readings un-abbreviated", () => {
    expect(globalThis.NS_META.fmtVph(950)).toBe("950/hr");
  });

  it("returns an empty string when there is no reading at all", () => {
    expect(globalThis.NS_META.fmtVph(null)).toBe("");
  });
});

describe("format the counts a card and a watch page share", () => {
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

  it("writes an absolute publish date", () => {
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

describe("the outlier reading", () => {
  it("tints by how far from usual the video sits", () => {
    expect(globalThis.NS_META.outlierTone(340)).toBe("hot");
    expect(globalThis.NS_META.outlierTone(100)).toBe("normal");
    expect(globalThis.NS_META.outlierTone(30)).toBe("cool");
  });

  it("has a neutral tone and no reading when there is nothing to compare against", () => {
    expect(globalThis.NS_META.outlierTone(null)).toBe("normal");
    expect(globalThis.NS_META.fmtOutlierScore(null)).toBe("");
    expect(globalThis.NS_META.outlierHint(null)).toBe("");
  });
});
