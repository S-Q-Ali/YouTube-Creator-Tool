/*
 * Which readings a chart range covers.
 *
 * The ranges used to be "the last 7 days", "the last 28", "everything" - all
 * measured from today. For a video that is the wrong axis. Measured from today,
 * a week-old video's "last 7 days" is its entire life, and an eight-month-old
 * video's is the only part anyone can still see. Neither tells you how the video
 * did, which is the one thing a video chart is for.
 *
 * So the age ranges are measured from the day it was published. The first week
 * after publishing is the window that decides whether a video found an audience,
 * and it is the only window where the number is still news.
 *
 * Which makes honesty the interesting part. This app keeps 90 days of readings,
 * so "the first 7 days" of a video from last year is a question it cannot
 * answer - the data was never taken. Returning the days it does have under a
 * tab labelled "1st 7 days" would be a lie in the control the reader just
 * clicked, and a chart of the wrong window looks exactly like a chart of the
 * right one. So a selection carries whether it is whole, whether the video has
 * simply not lived that long yet, and which piece is missing.
 *
 * 24h is the deliberate exception: trailing, not aged. Nobody opens a video to
 * see its first day.
 *
 * No module system in a content script, so this follows the pattern the other
 * extension libraries use and hangs off globalThis.
 */

(function attach(global) {
  const DAY_MS = 86_400_000;

  /*
   * There is no 24-hour range here, and that is a decision about the data rather
   * than an omission. The reference panel offers one, because it reads views
   * hourly. This app records one reading per day - lib/videoHistory.ts buckets
   * each day down to its last reading before anything sees it - so a 24-hour
   * window holds exactly one point, always, and a one-point window cannot draw
   * the line. A tab that can only ever show "not enough readings" is worse than
   * no tab: it is the one a reader lands on first, because the reader opens a
   * video to find out what it did today, and the first thing it would tell them
   * is that it cannot tell them.
   *
   * The shortest range has to be able to hold enough points to be a chart, and
   * that is enforced rather than remembered: a test asserts no range here can
   * ever be thinner than the three points a line needs.
   */
  const RANGES = [
    { key: "7d", label: "1st 7d", kind: "age", days: 7 },
    { key: "28d", label: "1st 28d", kind: "age", days: 28 },
    { key: "all", label: "All", kind: "all", days: null }
  ];

  /**
   * Pick the readings a range covers, and be honest about the cover.
   *
   * `truncated` and `incomplete` are different problems and mean opposite
   * things to a reader, so they are not one flag:
   *
   *   truncated  - the window starts before the readings begin. Readings we
   *               never took. The number on the chart is for a window the tab
   *               does not describe.
   *   incomplete - the video is younger than the window. Nothing is missing;
   *               the video has not lived that long. Charting it without saying
   *               so draws a cliff that reads as a collapse in views.
   */
  function select(points, options) {
    const opts = options || {};
    const range = RANGES.find((r) => r.key === opts.range);
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const list = Array.isArray(points) ? points.slice() : [];

    // Sorted on a copy. The route orders by ts, but a card re-rendered against
    // a cached payload is a second chance to be handed anything, and the first
    // point is what the age arithmetic is measured from.
    list.sort((a, b) => a.t - b.t);

    // An unknown key is not an error. A stale preference or a typo in a stored
    // one should show the whole series, not take the panel down with it.
    if (!range) return { points: list, truncated: false, incomplete: false, reason: null };

    if (range.kind === "all") return { points: list, truncated: false, incomplete: false, reason: null };

    if (range.kind === "trailing") {
      const from = now - range.days * DAY_MS;
      return {
        points: list.filter((p) => p.t >= from),
        truncated: false,
        incomplete: false,
        reason: null
      };
    }

    // The string is checked before it is parsed, and not after. `Number(null)`
    // is 0 and 0 is finite, so parsing first turns an absent publish date into a
    // confident epoch at 1970 and the window lands fifty years before any
    // reading - a chart of nothing, labelled "1st 7 days". This is the same
    // trap clampDays in lib/videoHistory.ts walks into, which is why the check
    // lives in the library rather than at each call site. A real publish date is
    // also never 0, so a non-positive value is treated as absent for the same
    // reason.
    const raw = opts.publishedAt;
    const publishedAt = raw == null || raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(publishedAt) || publishedAt <= 0) {
      return {
        points: [],
        truncated: false,
        incomplete: false,
        reason: "We do not know when this video was published, so its first week cannot be located."
      };
    }

    const windowEnd = publishedAt + range.days * DAY_MS;
    const kept = list.filter((p) => p.t >= publishedAt && p.t <= windowEnd);
    const earliest = list.length > 0 ? list[0].t : null;

    // The window opens before the first reading we hold: those days were never
    // recorded, and anything drawn from here is a fragment of a longer window.
    const truncated = earliest != null && publishedAt < earliest;

    // The other failure, and the one that looks worse. Today is inside the
    // window, so the video has not reached the end of it - there is nothing
    // missing, the video is just younger than the tab.
    const incomplete = now < windowEnd;

    let reason = null;
    if (truncated) {
      reason = `This video was published before the ${range.days} days of readings kept here begin, so the first ${range.days} days are not shown.`;
    } else if (incomplete) {
      reason = `This video is ${Math.max(0, Math.floor((now - publishedAt) / DAY_MS))} days old, so it has not filled its first ${range.days} days yet.`;
    }

    return { points: kept, truncated, incomplete, reason };
  }

  /**
   * The SVG path for a series, and whether there is anything to fill.
   *
   * Flat is the case worth writing down. When every reading is the same number
   * there is no span to divide by, so a plain min/max mapping has nowhere to put
   * the line - it lands a fixed margin above the floor, at the bottom of the
   * chart, under almost no fill. A video that got no views all week is a real
   * and common case, and that rendering says "collapsed to nothing" when it
   * means "did not move". So a flat series is drawn across the middle instead,
   * and reports itself so the caller can leave the fill out: a block of colour
   * under a level line reads as volume, and there was no volume.
   *
   * Returns geometry rather than markup so it can be tested without a DOM, and
   * so the one piece of arithmetic with an edge case in it is not buried in a
   * template string.
   */
  function geometry(points, options) {
    const W = (options && options.width) || 260;
    const H = (options && options.height) || 88;
    const M = 8; // keeps the stroke and the tallest point off the edge
    const views = points.map((p) => p.views);
    const lo = Math.min(...views);
    const hi = Math.max(...views);
    const flat = hi === lo;
    const span = hi - lo || 1;
    const step = views.length > 1 ? W / (views.length - 1) : W;

    const y = (v) => (flat ? H / 2 : H - ((v - lo) / span) * (H - M * 2) - M);
    const line = views
      .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");

    // Closed to the baseline so there is a shape to fill. An open path fills
    // unpredictably, which is how a chart ends up shaded on the wrong side of
    // its own line.
    const area = flat ? null : `${line} L${W},${H} L0,${H} Z`;

    return { line, area, flat, width: W, height: H };
  }

  global.NS_CHART_RANGE = { RANGES, select, geometry, DAY_MS };
})(globalThis);
