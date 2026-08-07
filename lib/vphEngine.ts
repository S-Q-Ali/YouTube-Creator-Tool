import { all } from "./db";
import type { VideoSnapshotRow } from "./types";

export interface VphResult {
  vph: number | null;
  windowHours: number;
  points: { ts: number; views: number }[];
  error?: string;
}

/** Returns the earliest snapshot >= 24h old (or the full series). */
export function getVideoSnapshots(videoId: string): VideoSnapshotRow[] {
  return all<VideoSnapshotRow>(
    `SELECT video_id AS videoId, ts, view_count AS viewCount, like_count AS likeCount, comment_count AS commentCount
     FROM video_snapshots WHERE video_id = $video_id ORDER BY ts ASC`,
    { video_id: videoId }
  );
}

/**
 * Views-per-hour over the last 24h, plus the full snapshot series for charts.
 * vidIQ's VPH is exactly this: a delta over their own cached history.
 */
export function computeVph(videoId: string, opts: { windowMs?: number } = {}): VphResult {
  const windowMs = opts.windowMs ?? 24 * 60 * 60 * 1000;
  const snapshots = getVideoSnapshots(videoId);
  const points = snapshots.map((s) => ({ ts: s.ts, views: s.viewCount }));

  if (snapshots.length < 2) {
    return {
      vph: null,
      windowHours: 0,
      points,
      error: "Need at least two snapshots (the poller records one hourly). Add this video to your watchlist.",
    };
  }

  const now = Date.now();
  const inWindow = snapshots.filter((s) => now - s.ts <= windowMs);
  const series = inWindow.length >= 2 ? inWindow : snapshots;

  const first = series[0];
  const last = series[series.length - 1];
  const deltaViews = last.viewCount - first.viewCount;
  const deltaHours = (last.ts - first.ts) / 3_600_000;

  if (deltaHours < 1) {
    return {
      vph: null,
      windowHours: deltaHours,
      points,
      error: "Less than 1 hour between snapshots — give the poller more time.",
    };
  }

  return {
    vph: Math.round((deltaViews / deltaHours) * 10) / 10,
    windowHours: Math.round(deltaHours * 10) / 10,
    points,
  };
}
