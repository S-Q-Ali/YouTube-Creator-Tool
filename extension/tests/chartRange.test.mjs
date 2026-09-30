import { beforeAll, describe, expect, it } from "vitest";

/*
 * Which snapshots a range covers, and - the part that actually matters - saying
 * so when it cannot.
 *
 * The ranges this app had were "the last 7 days", "the last 28", "everything".
 * Measured from today, all three answer the same question on a video that came
 * out last week - they differ only in how much of the video's whole life is
 * missing. For a video, the interesting window is the first week after it is
 * published: that is the one that decides whether it found an audience, and it
 * is the only window where "views" is still news rather than history. So the
 * ranges are measured from the day it was published, the way the reference panel
 * does it.
 *
 * That change is what makes honesty load-bearing rather than decorative. "The
 * first 7 days" for a video published two years ago is a request this app cannot
 * answer: the route only keeps 90 days, so the start of that window was never
 * recorded. Drawing the part it has and labelling it "1st 7 days" would be a
 * lie told in the range tab a reader just clicked. So the selection carries
 * whether it is whole, and the chart says which part is missing.
 */

beforeAll(async () => {
  await import("../lib/chartRange.js");
});

const DAY = 86_400_000;

const R = () => globalThis.NS_CHART_RANGE;

/* A plausible publish date, not epoch 0. Zero is what a naive fixture reaches
   for, and it is not a date any video was published on - a library that treats
   it as one locates the window fifty years before any reading exists. Fixtures
   that use a real date exercise the same code path production does. */
const PUBLISHED = 1_767_225_600_000; // 2026-01-01T00:00:00Z

/* One reading per day, starting `start` days after the publish date. */
function series(days, start = 0) {
  return Array.from({ length: days }, (_, i) => ({
    t: PUBLISHED + (start + i) * DAY,
    views: 1000 + i * 100,
    likes: 10 + i
  }));
}

describe("choosing what a range shows", () => {
  it("measures the age ranges from publication, not from today", () => {
    // Published 60 days ago, 60 days of readings. "First 7 days" is the first
    // week, which is nowhere near the last week - a trailing window would have
    // handed back days 53-59 and called them the video's opening.
    const points = series(60);
    const picked = R().select(points, { range: "7d", publishedAt: points[0].t, now: points[59].t + DAY });

    expect(picked.points).toHaveLength(8); // day 0 through day 7 inclusive
    expect(picked.points[0].t).toBe(points[0].t);
    expect(picked.points.at(-1).t).toBe(points[7].t);
    expect(picked.truncated).toBe(false);
  });



  it("returns everything for All, and says nothing is missing", () => {
    const points = series(12);
    const picked = R().select(points, { range: "all", publishedAt: points[0].t, now: points[11].t + DAY });

    expect(picked.points).toHaveLength(12);
    expect(picked.truncated).toBe(false);
  });

  it("flags a range that starts before the readings we kept", () => {
    // The whole point. A video from last year has no readings anywhere near its
    // first week, because the route keeps 90 days. Returning the days it does
    // have under a tab labelled "1st 7 days" would be a claim the data does not
    // support, so the selection says it is a piece of a bigger window.
    const points = series(10, 500 * DAY);
    const picked = R().select(points, { range: "7d", publishedAt: PUBLISHED - 400 * DAY, now: points[9].t + DAY });

    expect(picked.truncated).toBe(true);
    expect(picked.reason).toMatch(/published/i);
  });

  it("does not claim a window is whole when the video is younger than the window", () => {
    // A three-day-old video asking for "1st 28 days" has three days. The
    // readings we hold are complete, but the window is not, and those are
    // different: one is missing data, the other is a video that has not lived
    // that long yet. Both have to be visible or the chart implies a decline.
    const points = series(3);
    const picked = R().select(points, { range: "28d", publishedAt: points[0].t, now: points[2].t + DAY });

    expect(picked.truncated).toBe(false);
    expect(picked.incomplete).toBe(true);
  });

  it("cannot place an age range without a publish date, and says which is missing", () => {
    const points = series(10);
    const picked = R().select(points, { range: "7d", publishedAt: null, now: points[9].t + DAY });

    expect(picked.points).toEqual([]);
    expect(picked.reason).toMatch(/publish/i);
  });

  it("ignores a range key it does not know rather than throwing", () => {
    // A stale preference, a bookmarked state, a typo in a saved key. The card
    // renders on someone else's data; throwing here would take out the whole
    // panel, not just the chart.
    const points = series(5);
    const picked = R().select(points, { range: "fortnight", publishedAt: points[0].t, now: points[4].t + DAY });

    expect(picked.points).toHaveLength(5);
  });

  it("survives points arriving out of order", () => {
    // The route orders by ts, but a card can be re-rendered against a cached
    // payload and there is no reason to trust the order of anything a second
    // time.
    const points = series(10).reverse();
    const picked = R().select(points, { range: "7d", publishedAt: points.at(-1).t, now: points[0].t + DAY });

    expect(picked.points.map((p) => p.views)).toEqual([1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700]);
  });

  it("never hands back a point after the video's first week as its first week", () => {
    // Off-by-one in the inclusive end. Day 8 is not in the first 7 days, and a
    // boundary that quietly includes it shifts every reading on the chart.
    const points = series(20);
    const picked = R().select(points, { range: "7d", publishedAt: points[0].t, now: points[19].t + DAY });

    expect(picked.points.at(-1).views).toBe(1000 + 7 * 100);
  });
});

describe("drawing the series", () => {
  const at = (views) => R().geometry(views.map((v) => ({ views: v })));
  const pairs = (path) => path.split(/[ML]\s*/).filter(Boolean).map((s) => s.split(",").map(Number));

  it("keeps every point inside the chart", () => {
    const g = at([1000, 1200, 1100, 1500, 1700, 1600, 1800, 1750]);
    for (const [x, y] of pairs(g.line)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(g.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(g.height);
    }
  });

  it("puts the first point at the left and the last at the right", () => {
    const g = at([1, 2, 3, 4]);
    const pts = pairs(g.line);
    expect(pts[0][0]).toBe(0);
    expect(pts.at(-1)[0]).toBe(g.width);
  });

  it("never divides by a zero span and never writes a NaN into the path", () => {
    // A video with one reading, and a week in which nothing moved. Both used to
    // be a way to produce a path the browser silently refused to draw.
    expect(at([500]).line).not.toMatch(/NaN/);
    const g = at([500, 500, 500, 500, 500]);
    expect(g.line).not.toMatch(/NaN/);
    // The area is null for a flat series by design, so the check has to allow
    // for its absence rather than assuming a string is there.
    expect(g.area === null || !/NaN/.test(g.area)).toBe(true);
  });

  it("draws a flat series across the middle rather than on the floor", () => {
    // The case this whole function exists for. A video that got no views all
    // week is ordinary, and pinning that to the bottom of the chart under 8px
    // of fill reads as a collapse rather than as a week with no movement.
    const g = at([500, 500, 500, 500, 500]);
    const ys = pairs(g.line).map(([, y]) => y);
    const middle = g.height / 2;

    for (const y of ys) expect(Math.abs(y - middle)).toBeLessThan(1);
    expect(g.flat).toBe(true);
  });

  it("leaves the fill out of a flat series, because there is no volume to show", () => {
    // A block of colour under a level line says "these views happened". None
    // did, and the shading would be the louder claim on the chart.
    expect(at([500, 500, 500]).area).toBeNull();
    expect(at([500, 600, 500]).area).toContain("Z");
  });

  it("closes a moving series to the baseline so the area is fillable", () => {
    const g = at([1, 2, 3]);
    expect(g.flat).toBe(false);
    expect(g.area).toMatch(/^M/);
    expect(g.area.endsWith("Z")).toBe(true);
    expect(g.area).toContain(`L${g.width},${g.height}`);
  });
});

describe("the range tabs themselves", () => {
  it("are labelled so a trailing window never reads as an age window", () => {
    // "7d" is ambiguous between "last 7 days" and "first 7 days", and those are
    // different questions. The word is what disambiguates it, so it is load
    // bearing copy, not decoration.
    const byKey = Object.fromEntries(R().RANGES.map((r) => [r.key, r.label]));
    expect(byKey["7d"]).toMatch(/1st/i);
    expect(byKey["28d"]).toMatch(/1st/i);
    expect(byKey.all).toMatch(/all/i);
  });

  it("has no range thinner than a line needs", () => {
    // The one that would have caught a 24-hour tab. The reference panel has
    // hourly readings; this app records one per day, so a 24h window holds
    // exactly one point and can only ever say "not enough readings" - while
    // sitting first in the row, where a reader lands by default. The tab looked
    // reasonable and could not draw a chart in any circumstance.
    //
    // So the rule is structural rather than a matter of taste: no range may be
    // short enough to be unable to hold CHART_MIN_POINTS. If someone adds a
    // shorter range later, this fails and asks whether the readings are daily
    // enough to support it.
    const MIN = 3; // the card's CHART_MIN_POINTS: fewer than this draws no line
    for (const r of R().RANGES) {
      if (r.kind === "all") continue;
      // An age range holds day 0 through day N inclusive.
      const cap = r.kind === "trailing" ? r.days : r.days + 1;
      expect(cap, `range "${r.label}" can hold at most ${cap} points, so it can never draw a line`).toBeGreaterThanOrEqual(MIN);
    }
  });

  it("leads with the first week, the window that decides whether a video found an audience", () => {
    expect(R().RANGES[0].key).toBe("7d");
  });
});
