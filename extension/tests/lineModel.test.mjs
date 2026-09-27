import { beforeAll, describe, expect, it } from "vitest";

/*
 * What the strip under a grid card says is a decision, not markup: which
 * readings, in which row, and what to name them. YouTube's own card row already
 * prints the channel, the rounded view count and how old the video is, so the
 * strip carries only the three readings it cannot show — subscribers, velocity
 * and the outlier score — and waits for the server rather than repeating or
 * estimating. It lives in a classic content-script file so this test drives the
 * exact file the extension runs.
 */
beforeAll(async () => {
  await import("../lib/nsMeta.js");
  await import("../lib/lineModel.js");
});

const READINGS = {
  vph: 16_700,
  vphDay: 400_000,
  views: 1_234_567,
  publishedAt: "2026-09-24T09:00:00.000Z",
  durationSeconds: 222,
  subscribers: 128_000,
  outlier: 340,
  spike: false
};

const CARD_TEXT = { views: 1_200_000, ageHours: 72, ageLabel: "3 days ago" };

function model(overrides = {}) {
  return globalThis.NS_LINE_MODEL.build({
    mode: overrides.mode || "full",
    facts: overrides.facts || CARD_TEXT,
    model: { ...READINGS, ...(overrides.model || {}) }
  });
}

function text(cells) {
  return cells.map(([value]) => value);
}

function hints(cells) {
  return cells.map(([, , title]) => title);
}

describe("the strip under a grid card", () => {
  it("holds only the subscribers on the first row", () => {
    expect(text(model().ctx)).toEqual(["128K subs"]);
  });

  it("puts velocity and the outlier score on the second row", () => {
    expect(text(model().judge)).toEqual(["16.7K/hr", "3.4×"]);
  });

  it("repeats nothing the card's own row already prints", () => {
    const strip = model();
    const all = [...text(strip.ctx), ...text(strip.judge)].join(" ");
    expect(all).not.toMatch(/views/i);
    expect(all).not.toMatch(/ago/);
    expect(all).not.toMatch(/2026/);
  });

  it("ignores the readings the card text already gave us", () => {
    // Tier 0 facts arrive with the tile. The strip would rather stay empty for
    // a second than print an estimate it has to correct a moment later.
    const before = globalThis.NS_LINE_MODEL.build({
      mode: "full",
      facts: CARD_TEXT,
      model: { vph: null }
    });
    expect(before.blank).toBe(true);
  });

  it("marks a hot outlier so the strip can tint it", () => {
    expect(model().judge[1][1]).toContain("ns-line-out--hot");
  });

  it("tints a video well under its channel pace as quiet", () => {
    expect(model({ model: { outlier: 30 } }).judge[1][1]).toContain("ns-line-out--cool");
  });

  it("shows the score at one decimal, so a typical video reads 1.0×", () => {
    expect(text(model({ model: { outlier: 100 } }).judge)).toEqual(["16.7K/hr", "1.0×"]);
  });

  it("tints a spiking velocity amber", () => {
    expect(model({ model: { spike: true } }).judge[0][1]).toContain("ns-line-vel--spike");
  });

  it("names every reading for the hover and for a screen reader", () => {
    expect(hints(model().ctx)).toEqual(["Channel subscribers"]);
    expect(hints(model().judge)).toEqual([
      "Views per hour since publish",
      "3.4× what this channel usually gets"
    ]);
  });
});

describe("before the server answers", () => {
  it("hides itself rather than reserving empty space", () => {
    expect(model({ model: { vph: null, subscribers: null, outlier: null } }).blank).toBe(true);
  });
});

describe("off", () => {
  it("asks for no readings at all", () => {
    const off = model({ mode: "off" });
    expect(off.ctx).toEqual([]);
    expect(off.judge).toEqual([]);
    expect(off.blank).toBe(true);
  });
});
