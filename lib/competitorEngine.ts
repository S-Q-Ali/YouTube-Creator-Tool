import { all } from "./db";
import { computeVph } from "./vphEngine";
import { getKeywordSnapshots } from "./keywordEngine";

export interface TrackedVideoDashboard {
  videoId: string;
  title: string | null;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  addedAt: number;
  vph: number | null;
  vphWindowHours: number;
  vphError?: string;
  series: { ts: number; value: number }[];
}

export interface TrackedChannelDashboard {
  channelId: string;
  title: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  addedAt: number;
  growth7d: number | null;
  series: { ts: number; value: number }[];
}

export interface TrackedKeywordDashboard {
  term: string;
  displayTerm: string;
  score: number;
  demandScore: number;
  competitionLabel: string;
  addedAt: number;
  series: { ts: number; value: number }[];
  rankedVideos: { videoId: string; title: string; channelTitle: string; position: number; ts: number }[];
}

export interface CompetitorDashboard {
  videos: TrackedVideoDashboard[];
  channels: TrackedChannelDashboard[];
  keywords: TrackedKeywordDashboard[];
}

interface TrackedVideoRow {
  ref_id: string;
  label: string;
  added_at: number;
  title: string | null;
  thumbnail_url: string | null;
  channel_id: string | null;
  published_at: string | null;
  view_count: number;
  like_count: number | null;
  comment_count: number | null;
}

interface TrackedChannelRow {
  ref_id: string;
  label: string;
  added_at: number;
  title: string | null;
  thumbnail_url: string | null;
  subscriber_count: number;
  video_count: number;
  view_count: number;
}

export function getTrackedVideos(): TrackedVideoDashboard[] {
  const rows = all<TrackedVideoRow>(
    `SELECT t.ref_id, t.label, t.added_at,
            v.title, v.thumbnail_url, v.channel_id, v.published_at,
            v.view_count, v.like_count, v.comment_count
     FROM tracked_items t
     LEFT JOIN videos v ON v.video_id = t.ref_id
     WHERE t.kind = 'video'
     ORDER BY t.added_at DESC`
  );

  return rows.map((r) => {
    const vph = computeVph(r.ref_id);
    return {
      videoId: r.ref_id,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      channelTitle: r.channel_id,
      publishedAt: r.published_at,
      viewCount: r.view_count,
      likeCount: r.like_count,
      commentCount: r.comment_count,
      addedAt: r.added_at,
      vph: vph.vph,
      vphWindowHours: vph.windowHours,
      vphError: vph.error,
      series: vph.points.map((p) => ({ ts: p.ts, value: p.views })),
    };
  });
}

export function getTrackedChannels(): TrackedChannelDashboard[] {
  const rows = all<TrackedChannelRow>(
    `SELECT t.ref_id, t.label, t.added_at,
            c.title, c.thumbnail_url, c.subscriber_count, c.video_count, c.view_count
     FROM tracked_items t
     LEFT JOIN channels c ON c.channel_id = t.ref_id
     WHERE t.kind = 'channel'
     ORDER BY t.added_at DESC`
  );

  return rows.map((r) => {
    const snapshots = all<{ ts: number; subscriber_count: number }>(
      "SELECT ts, subscriber_count FROM channel_snapshots WHERE channel_id = $id ORDER BY ts ASC",
      { id: r.ref_id }
    );
    const series = snapshots.map((s) => ({ ts: s.ts, value: s.subscriber_count }));
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = snapshots.filter((s) => s.ts >= weekAgo);
    const oldest = recent.length >= 2 ? recent[0] : snapshots[0];
    const latest = snapshots[snapshots.length - 1];
    const growth7d =
      oldest && latest && latest.subscriber_count != null && oldest.subscriber_count != null
        ? latest.subscriber_count - oldest.subscriber_count
        : null;
    return {
      channelId: r.ref_id,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      subscriberCount: r.subscriber_count,
      videoCount: r.video_count,
      viewCount: r.view_count,
      addedAt: r.added_at,
      growth7d,
      series,
    };
  });
}

interface TrackedKeywordRow {
  ref_id: string;
  added_at: number;
  term: string | null;
  display_term: string | null;
  score: number;
  demand_score: number;
  competition_label: string;
}

export function getTrackedKeywords(): TrackedKeywordDashboard[] {
  const rows = all<TrackedKeywordRow>(
    `SELECT t.ref_id, t.added_at, k.term, k.display_term, k.score, k.demand_score, k.competition_label
     FROM tracked_items t
     LEFT JOIN keywords k ON k.term = t.ref_id
     WHERE t.kind = 'keyword'
     ORDER BY t.added_at DESC`
  );

  return rows.map((r) => {
    const snapshots = getKeywordSnapshots(r.ref_id);
    const ranked = all<{ video_id: string; position: number; ts: number }>(
      `SELECT video_id, position, ts FROM rankings WHERE term = $term AND ts = (SELECT MAX(ts) FROM rankings WHERE term = $term)`,
      { term: r.ref_id }
    );
    const titleRows = ranked.length
      ? all<{ video_id: string; title: string | null }>(
          `SELECT video_id, title FROM videos WHERE video_id IN (${ranked.map((_, i) => `$${i}`).join(",")})`,
          Object.fromEntries(ranked.map((v, i) => [String(i), v.video_id]))
        )
      : [];
    const titleBy = new Map(titleRows.map((t) => [t.video_id, t.title]));
    return {
      term: r.ref_id,
      displayTerm: r.display_term ?? r.ref_id,
      score: r.score,
      demandScore: r.demand_score,
      competitionLabel: r.competition_label,
      addedAt: r.added_at,
      series: snapshots.map((s) => ({ ts: s.ts, value: s.score ?? 0 })),
      rankedVideos: ranked.map((v) => ({
        videoId: v.video_id,
        title: titleBy.get(v.video_id) ?? v.video_id,
        channelTitle: "",
        position: v.position,
        ts: v.ts,
      })),
    };
  });
}

export function getCompetitorDashboard(): CompetitorDashboard {
  return {
    videos: getTrackedVideos(),
    channels: getTrackedChannels(),
    keywords: getTrackedKeywords(),
  };
}
