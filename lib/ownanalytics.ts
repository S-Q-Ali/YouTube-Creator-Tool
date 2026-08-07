import { getValidAccessToken, isConnected, setOwnChannelId } from "./oauth";
import { all, run } from "./db";

interface ChannelSnippet {
  title?: string;
  description?: string;
  customUrl?: string;
  publishedAt?: string;
  thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
  country?: string;
}

interface ChannelResource {
  id?: string;
  snippet?: ChannelSnippet;
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
  brandingSettings?: { channel?: { keywords?: string } };
}

function num(s: string | number | undefined | null): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

async function authedJson(base: string, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const token = await getValidAccessToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base}/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`Google API error (${res.status}): ${detail}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export interface OwnChannelInfo {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl: string;
  country: string;
  publishedAt: string;
  subscriberCount: number;
  hiddenSubscribers: boolean;
  videoCount: number;
  viewCount: number;
  keywords: string[];
}

/** Fetch the signed-in user's own channel via channels.list?mine=true. */
export async function fetchOwnChannel(): Promise<OwnChannelInfo> {
  const j = (await authedJson("https://www.googleapis.com/youtube/v3", "channels", {
    part: "snippet,statistics,brandingSettings",
    mine: "true",
  })) as { items?: ChannelResource[] };

  const item = j.items?.[0];
  if (!item?.id) throw new Error("No channel found for this account.");
  setOwnChannelId(item.id);

  const sn = item.snippet ?? {};
  const st = item.statistics ?? {};
  const keywords = item.brandingSettings?.channel?.keywords
    ?.split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean) ?? [];

  return {
    channelId: item.id,
    title: sn.title ?? "",
    description: sn.description ?? "",
    thumbnailUrl: sn.thumbnails?.medium?.url ?? sn.thumbnails?.high?.url ?? sn.thumbnails?.default?.url ?? "",
    customUrl: sn.customUrl ?? "",
    country: sn.country ?? "",
    publishedAt: sn.publishedAt ?? "",
    subscriberCount: num(st.subscriberCount),
    hiddenSubscribers: Boolean(st.hiddenSubscriberCount),
    videoCount: num(st.videoCount),
    viewCount: num(st.viewCount),
    keywords,
  };
}

export interface AnalyticsTotals {
  views: number;
  estimatedMinutesWatched: number;
  subscribersGained: number;
  subscribersLost: number;
  averageViewDurationSeconds: number;
  averageViewPercentage: number;
  likes: number;
  comments: number;
}

export interface DayRow {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  subscribersGained: number;
  subscribersLost: number;
  averageViewDurationSeconds: number;
}

/** Pull totals + per-day rows from the YouTube Analytics reports API for a channel. */
export async function fetchChannelAnalytics(
  channelId: string,
  opts: { startDate?: string; endDate?: string } = {}
): Promise<{ totals: AnalyticsTotals; days: DayRow[] }> {
  const end = opts.endDate ?? new Date().toISOString().slice(0, 10);
  const start = opts.startDate ?? new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

  const ids = `channel==${channelId}`;

  const totalsJ = (await authedJson("https://youtubeanalytics.googleapis.com/v2", "reports", {
    ids,
    startDate: start,
    endDate: end,
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,averageViewPercentage,likes,comments",
  })) as { rows?: (string | number)[][] };

  const daysJ = (await authedJson("https://youtubeanalytics.googleapis.com/v2", "reports", {
    ids,
    startDate: start,
    endDate: end,
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration",
    dimensions: "day",
    sort: "day",
  })) as { rows?: (string | number)[][] };

  const totals: AnalyticsTotals = {
    views: 0,
    estimatedMinutesWatched: 0,
    subscribersGained: 0,
    subscribersLost: 0,
    averageViewDurationSeconds: 0,
    averageViewPercentage: 0,
    likes: 0,
    comments: 0,
  };
  const r = totalsJ.rows?.[0];
  if (r) {
    totals.views = num(r[0]);
    totals.estimatedMinutesWatched = num(r[1]);
    totals.subscribersGained = num(r[2]);
    totals.subscribersLost = num(r[3]);
    totals.averageViewDurationSeconds = num(r[4]);
    totals.averageViewPercentage = num(r[5]);
    totals.likes = num(r[6]);
    totals.comments = num(r[7]);
  }

  const days: DayRow[] = (daysJ.rows ?? []).map((row) => ({
    date: String(row[0]),
    views: num(row[1]),
    estimatedMinutesWatched: num(row[2]),
    subscribersGained: num(row[3]),
    subscribersLost: num(row[4]),
    averageViewDurationSeconds: num(row[5]),
  }));

  return { totals, days };
}

export interface OwnAudit {
  connected: boolean;
  channel?: OwnChannelInfo;
  analytics?: { totals: AnalyticsTotals; days: DayRow[] };
  recentVideos?: { videoId: string; title: string; publishedAt: string; viewCount: number; durationSeconds: number; channelId: string }[];
  error?: string;
}

/**
 * Assemble the own-channel audit: channel info + 28-day analytics.
 * recentVideos come from the local cache (populated when you look up your uploads).
 */
export async function getOwnAudit(): Promise<OwnAudit> {
  if (!isConnected()) return { connected: false };

  try {
    const channel = await fetchOwnChannel();
    const analytics = await fetchChannelAnalytics(channel.channelId);
    return { connected: true, channel, analytics };
  } catch (err) {
    return { connected: true, error: err instanceof Error ? err.message : "Audit failed" };
  }
}

/** Snapshots the own channel into channel_snapshots so the poller/dashboard can trend it. */
export function snapshotOwnChannel(channel: OwnChannelInfo) {
  const ts = Math.floor(Date.now() / 600000) * 600000;
  run(
    `INSERT OR IGNORE INTO channel_snapshots (channel_id, ts, subscriber_count, video_count, view_count)
     VALUES ($id, $ts, $subs, $videos, $views)`,
    {
      id: channel.channelId,
      ts,
      subs: channel.subscriberCount,
      videos: channel.videoCount,
      views: channel.viewCount,
    }
  );
}

/** Videos owned by the signed-in channel, from the local cache (empty until uploads are fetched). */
export function getOwnRecentVideos(channelId: string) {
  return all<{ videoId: string; title: string; publishedAt: string; viewCount: number; durationSeconds: number; channelId: string }>(
    `SELECT video_id AS videoId, title, published_at AS publishedAt, view_count AS viewCount, duration_seconds AS durationSeconds, channel_id AS channelId
     FROM videos WHERE channel_id = $channelId ORDER BY published_at DESC LIMIT 20`,
    { channelId }
  );
}
