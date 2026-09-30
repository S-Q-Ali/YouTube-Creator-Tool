/**
 * A video's view history, shaped for a chart.
 *
 * The series only exists for videos somebody put on the watch list: the poller
 * writes a snapshot row per tracked video, and a video nobody tracked has no
 * rows at all. So the useful job here is not to produce a number but to be
 * honest about how much history was found, because a chart drawn off two dots
 * looks exactly like a chart drawn off a month of readings and means something
 * completely different.
 *
 * Kept out of the route so the collapsing can be tested without a database.
 */

export const DAY_MS = 86_400_000;

/** Enough for a month, and the ceiling so a client cannot ask for everything. */
export const DEFAULT_HISTORY_DAYS = 30;
export const MAX_HISTORY_DAYS = 90;

/** A week is the shortest run worth drawing a slope across. */
export const MIN_DAYS_FOR_TREND = 7;

export interface Snapshot {
  ts: number;
  view_count: number | null;
  like_count: number | null;
}

export interface HistoryPoint {
  /** Epoch ms at the start of the day, so a client can bucket by range. */
  t: number;
  views: number;
  likes: number | null;
}

export interface HistorySeries {
  videoId: string;
  points: HistoryPoint[];
  /** How much wall-clock time the first and last rows actually span. */
  spanDays: number;
  /** Set when the series is too thin to be worth drawing as a trend. */
  partial: boolean;
}

interface Newest {
  ts: number;
  views: number;
  likes: number | null;
}

/**
 * Collapse raw snapshots to one point per day, keeping each day's last reading.
 *
 * The poller can write many rows a day and a chart does not want them all. The
 * last reading of a day is the one worth keeping, because it is the value a
 * person would quote if they asked "where was this video on Tuesday". Rows are
 * not assumed to arrive in order, so the newest reading of each day is chosen
 * rather than whichever happened to be seen last.
 */
export function bucketByDay(rows: readonly Snapshot[]): HistoryPoint[] {
  const newest = new Map<number, Newest>();
  for (const row of rows) {
    // A row with no view count is a failed read, not a video that lost views.
    if (row.view_count == null) continue;
    const day = Math.floor(row.ts / DAY_MS) * DAY_MS;
    const held = newest.get(day);
    if (!held || row.ts > held.ts) {
      newest.set(day, { ts: row.ts, views: row.view_count, likes: row.like_count ?? null });
    }
  }
  return [...newest.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, row]) => ({ t: day, views: row.views, likes: row.likes }));
}

export function buildSeries(videoId: string, rows: readonly Snapshot[]): HistorySeries {
  const points = bucketByDay(rows);
  const spanDays = points.length > 1 ? Math.round((points[points.length - 1].t - points[0].t) / DAY_MS) : 0;
  return {
    videoId,
    points,
    spanDays,
    partial: points.length < 3 || spanDays < MIN_DAYS_FOR_TREND
  };
}

/**
 * Clamp a requested window into something the route is willing to read.
 *
 * Takes the raw query-string value rather than a number, because parsing it at
 * the call site is where this went wrong once: `Number(null)` is `0`, not
 * `null`, so a request that asked for no window at all was clamped to a single
 * day and the chart silently came back nearly empty. Reading the string here
 * keeps "absent", "blank" and "unreadable" all meaning the default.
 */
export function clampDays(requested: string | number | null | undefined): number {
  if (requested == null) return DEFAULT_HISTORY_DAYS;
  // An empty parameter is an absent one. `Number("")` is 0 and `Number("  ")`
  // is 0 too, so a blank `?days=` would otherwise be clamped to a single day
  // and answered as though one day had been asked for.
  if (typeof requested === "string" && requested.trim() === "") return DEFAULT_HISTORY_DAYS;
  const asked = typeof requested === "number" ? requested : Number(requested.trim());
  if (!Number.isFinite(asked)) return DEFAULT_HISTORY_DAYS;
  return Math.min(MAX_HISTORY_DAYS, Math.max(1, Math.round(asked)));
}
