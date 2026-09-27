import { beforeAll, describe, expect, it } from "vitest";

/*
 * What a grid line says is a decision, not markup: which readings, in which
 * row, for which density. It lives in a classic content-script file beside the
 * parser so this test can drive the exact file the extension runs.
 */
beforeAll(async () => {
  await import("../lib/nsMeta.js");
  await import("../lib/lineModel.js");
});

function model(overrides = {}) {
  const facts = { views: 1_200_000, ageHours: 72, ageLabel: "3 days ago" };
  const readings = {
    vph: 16_700,
    vphDay: 400_000,
    views: 1_234_567,
    publishedAt: "2026-09-24T09:00:00.000Z",
    durationSeconds: 222,
    subscribers: 128_000,
    outlier: 340,
    spike: false
  };
  return globalThis.NS_LINE_MODEL.build({
    mode: overrides.mode || "full",
    facts,
    model: { ...readings, ...(overrides.model || {}) },
    hasDurationBadge: "hasDurationBadge" in overrides ? overrides.hasDurationBadge : true
  });
}

function text(cells) {
  return cells.map(([value]) => value);
}

describe("full density", () => {
  it("puts the readings a card cannot show on the context row", () => {
    expect(text(model().ctx)).toEqual(["1 234 567 views", "24 Sept 2026", "128K subs"]);
  });

  it("puts velocity and the outlier on the judgment row", () => {
    expect(text(model().judge)).toEqual(["16.7K/hr", "3.4× usual"]);
  });

  it("leaves out the runtime badge YouTube already painted on the thumbnail", () => {
    expect(text(model({ hasDurationBadge: true }).ctx)).toHaveLength(3);
    expect(text(model({ hasDurationBadge: false }).ctx)).toEqual([
      "1 234 567 views",
      "24 Sept 2026",
      "128K subs",
      "3:42"
    ]);
  });

  it("marks an outlier that runs hot so the line can tint it", () => {
    const cells = model().judge;
    expect(cells[1][1]).toContain("ns-line-out--hot");
  });

  it("tints a video well under its channel pace as quiet", () => {
    expect(model({ model: { outlier: 30 } }).judge[1][1]).toContain("ns-line-out--cool");
  });

  it("calls a video on its channel's usual pace typical", () => {
    expect(text(model({ model: { outlier: 100 } }).judge)).toEqual(["16.7K/hr", "typical"]);
  });

  it("tints a spiking velocity amber", () => {
    expect(model({ model: { spike: true } }).judge[0][1]).toContain("ns-line-vel--spike");
  });
});

describe("before the server answers", () => {
  function tier0() {
    return globalThis.NS_LINE_MODEL.build({
      mode: "full",
      facts: { views: 1_200_000, ageHours: 72, ageLabel: "3 days ago" },
      model: { vph: null },
      hasDurationBadge: true
    });
  }

  it("uses the views and age the card text already printed", () => {
    expect(text(tier0().ctx)).toEqual(["1.2M views", "3 days ago"]);
  });

  it("shows velocity from the parsed card text", () => {
    expect(text(tier0().judge)).toEqual(["16.7K/hr"]);
  });

  it("leaves a blank line hidden rather than reserving empty space", () => {
    const empty = globalThis.NS_LINE_MODEL.build({
      mode: "full",
      facts: { views: null, ageHours: null, ageLabel: null },
      model: { vph: null },
      hasDurationBadge: true
    });
    expect(empty.blank).toBe(true);
    expect(model().blank).toBe(false);
  });
});

describe("compact density", () => {
  it("shows only the judgment row", () => {
    const compact = model({ mode: "compact" });
    expect(text(compact.judge)).toEqual(["16.7K/hr", "3.4× usual"]);
    expect(compact.ctx).toEqual([]);
  });

  it("still leaves runtime space free on a card that has no badge", () => {
    expect(model({ mode: "compact", hasDurationBadge: false }).showDur).toBe(false);
  });
});

describe("off density", () => {
  it("asks for no readings at all", () => {
    const off = model({ mode: "off" });
    expect(off.ctx).toEqual([]);
    expect(off.judge).toEqual([]);
    expect(off.blank).toBe(true);
  });
});
