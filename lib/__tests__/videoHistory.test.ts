import { describe, it, expect } from "vitest";
import { bucketByDay, buildSeries, clampDays, DAY_MS } from "../videoHistory";

/**
 * The view-history series behind the card's chart.
 *
 * These are pure functions on purpose: the route is a thin read over the
 * snapshot table, and the part worth testing is the collapsing, because a
 * chart drawn off the wrong point per day is a chart that is confidently
 * wrong. A day should show the value the poller last saw that day, not the
 * first, not the average, and not whichever row happened to arrive last.
 */

const DAY = DAY_MS;
/** A fixed base day so the tests do not depend on when they are run. */
const D0 = 1_760_000_000_000 - (1_760_000_000_000 % DAY);

const at = (day: number, hour = 12) => D0 + day * DAY + hour * 3_600_000;

describe("bucketByDay", () => {
  it("keeps one point per day", () => {
    const points = bucketByDay([
      { ts: at(0, 1), view_count: 100, like_count: 5 },
      { ts: at(0, 2), view_count: 150, like_count: 7 },
      { ts: at(0, 3), view_count: 180, like_count: 9 },
      { ts: at(1, 1), view_count: 400, like_count: 20 }
    ]);
    expect(points).toHaveLength(2);
  });

  it("keeps the last reading of each day, not the first or the average", () => {
    const points = bucketByDay([
      { ts: at(0, 1), view_count: 100, like_count: 5 },
      { ts: at(0, 9), view_count: 350, like_count: 30 },
      { ts: at(0, 23), view_count: 900, like_count: 80 }
    ]);
    expect(points[0].views).toBe(900);
    expect(points[0].likes).toBe(80);
  });

  it("does not depend on the order the rows arrive in", () => {
    const rows = [
      { ts: at(0, 23), view_count: 900, like_count: null },
      { ts: at(0, 1), view_count: 100, like_count: null },
      { ts: at(0, 9), view_count: 350, like_count: null }
    ];
    const forwards = bucketByDay(rows);
    const backwards = bucketByDay([...rows].reverse());
    expect(backwards).toEqual(forwards);
    expect(backwards[0].views).toBe(900);
  });

  it("sorts the days oldest first so the chart reads left to right", () => {
    const points = bucketByDay([
      { ts: at(4), view_count: 5, like_count: null },
      { ts: at(0), view_count: 1, like_count: null },
      { ts: at(2), view_count: 3, like_count: null }
    ]);
    expect(points.map((p) => p.views)).toEqual([1, 3, 5]);
  });

  it("snaps each day to its start so buckets line up", () => {
    const points = bucketByDay([{ ts: at(0, 23), view_count: 1, like_count: null }]);
    expect(points[0].t).toBe(D0);
    expect(points[0].t % DAY).toBe(0);
  });

  it("skips rows with no view count rather than charting a drop to zero", () => {
    const points = bucketByDay([
      { ts: at(0), view_count: 100, like_count: 5 },
      { ts: at(1), view_count: null, like_count: 5 },
      { ts: at(2), view_count: 300, like_count: 9 }
    ]);
    expect(points).toHaveLength(2);
    expect(points.map((p) => p.views)).toEqual([100, 300]);
  });

  it("is empty for no rows, which is what an untracked video looks like", () => {
    expect(bucketByDay([])).toEqual([]);
  });
});

describe("buildSeries", () => {
  const week = (n: number, start = 100) =>
    Array.from({ length: n }, (_, i) => ({ ts: at(i), view_count: start + i * 10, like_count: null }));

  it("reports how many days the readings actually span", () => {
    const series = buildSeries("dQw4w9WgXcQ", week(11));
    expect(series.points).toHaveLength(11);
    expect(series.spanDays).toBe(10);
  });

  it("marks a full week of cover as a real trend", () => {
    expect(buildSeries("dQw4w9WgXcQ", week(8)).partial).toBe(false);
  });

  it("marks a short run partial, so the card offers to track rather than charting it", () => {
    // Two dots make a line with no slope worth drawing.
    expect(buildSeries("dQw4w9WgXcQ", week(2)).partial).toBe(true);
    expect(buildSeries("dQw4w9WgXcQ", week(4)).partial).toBe(true);
  });

  it("marks many rows in a few days partial, because span is what matters", () => {
    const crowded = Array.from({ length: 30 }, (_, i) => ({
      ts: at(0) + i * 60 * 60_000,
      view_count: 100 + i,
      like_count: null
    }));
    // All inside one day, so there is one point and no span at all.
    expect(buildSeries("dQw4w9WgXcQ", crowded).partial).toBe(true);
  });

  it("marks an untracked video partial and empty, never as flat growth", () => {
    const series = buildSeries("dQw4w9WgXcQ", []);
    expect(series.points).toEqual([]);
    expect(series.spanDays).toBe(0);
    expect(series.partial).toBe(true);
  });

  it("carries the video id back so a client cannot mix up two charts", () => {
    expect(buildSeries("abcdefghijk", week(8)).videoId).toBe("abcdefghijk");
  });
});

describe("clampDays", () => {
  it("defaults to a month when no window is asked for", () => {
    expect(clampDays(null)).toBe(30);
    expect(clampDays(undefined)).toBe(30);
  });

  it("falls back to the default on input that is not a number", () => {
    expect(clampDays(Number.NaN)).toBe(30);
    expect(clampDays(Number.POSITIVE_INFINITY)).toBe(30);
  });

  it("accepts a window inside the allowed range", () => {
    expect(clampDays(7)).toBe(7);
    expect(clampDays(28)).toBe(28);
  });

  it("rounds a fractional window", () => {
    expect(clampDays(6.6)).toBe(7);
  });

  it("refuses a window longer than the ceiling", () => {
    expect(clampDays(365)).toBe(90);
  });

  it("refuses a window of zero or less", () => {
    expect(clampDays(0)).toBe(1);
    expect(clampDays(-10)).toBe(1);
  });
});

/**
 * The route passes the raw query-string value, so this is the path that
 * actually runs. It is here because the bug it guards was invisible to the
 * tests above: the route used to write `Number(param)`, and `Number(null)` is
 * `0`, so a request with no `days` at all was clamped to one day and answered
 * with a near-empty chart while reporting `days: 1` as though that were asked
 * for. `clampDays(null)` passed the whole time, because nothing called it.
 */
describe("clampDays on a raw query-string value", () => {
  it("defaults to a month when the parameter is absent", () => {
    // What `searchParams.get` returns for a missing key.
    expect(clampDays(null)).toBe(30);
    // And the mistake itself, spelled out: coercing first loses the default.
    expect(clampDays(Number(null))).toBe(1);
  });

  it("defaults to a month when the parameter is blank or unreadable", () => {
    expect(clampDays("")).toBe(30);
    expect(clampDays("   ")).toBe(30);
    expect(clampDays("abc")).toBe(30);
  });

  it("reads a window that was actually asked for", () => {
    expect(clampDays("7")).toBe(7);
    expect(clampDays("28")).toBe(28);
    expect(clampDays("90")).toBe(90);
  });

  it("clamps and rounds a string window the same as a numeric one", () => {
    expect(clampDays("365")).toBe(90);
    expect(clampDays("6.6")).toBe(7);
    expect(clampDays("0")).toBe(1);
  });
});
