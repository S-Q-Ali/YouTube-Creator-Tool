import { config, requireApiKey } from "./config";
import { all, get, run } from "./db";
import type { ChannelInfo, VideoInfo } from "./types";

export class YoutubeApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = "YoutubeApiError";
  }
}

export class QuotaExceededError extends YoutubeApiError {
  constructor() {
    super("YouTube API daily quota exceeded. Results may be stale until quota resets (midnight PT).", "quotaExceeded", 403);
    this.name = "QuotaExceededError";
  }
}

export class RateLimitedError extends YoutubeApiError {
  constructor() {
    super("YouTube API rate limit hit. Backing off.", "rateLimitExceeded", 429);
    this.name = "RateLimitedError";
  }
}

const DATA_QUOTA_LIMIT = 10_000;
const SEARCH_QUOTA_LIMIT = 100;

function quotaKey(bucket: string): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return `quota:${bucket}:${ymd}`;
}

export function getQuotaUsage(bucket: "data" | "search"): { used: number; limit: number } {
  const used = Number(get<{ value: string }>("SELECT value FROM settings WHERE key = $key", { key: quotaKey(bucket) })?.value ?? 0);
  return { used, limit: bucket === "search" ? SEARCH_QUOTA_LIMIT : DATA_QUOTA_LIMIT };
}

export function getQuotaStatus() {
  const data = getQuotaUsage("data");
  const search = getQuotaUsage("search");
  return {
    data: { ...data, remaining: Math.max(0, data.limit - data.used) },
    search: { ...search, remaining: Math.max(0, search.limit - search.used) },
  };
}

/** Daily usage for the last `days` days (per-UTC-day ledger entries). */
export function getQuotaHistory(days = 7): { date: string; data: number; search: number }[] {
  const out: { date: string; data: number; search: number }[] = [];
  const keys = all<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key LIKE 'quota:%'"
  );
  const byDay = new Map<string, { data: number; search: number }>();
  for (const { key, value } of keys) {
    const m = key.match(/^quota:(data|search):(\d{4}-\d{2}-\d{2})$/);
    if (!m) continue;
    const bucket = m[1] as "data" | "search";
    const ymd = m[2];
    const entry = byDay.get(ymd) ?? { data: 0, search: 0 };
    entry[bucket] = Number(value);
    byDay.set(ymd, entry);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    out.push({ date: ymd, ...(byDay.get(ymd) ?? { data: 0, search: 0 }) });
  }
  return out;
}

function recordQuota(bucket: "data" | "search", units: number) {
  const key = quotaKey(bucket);
  const used = Number(get<{ value: string }>("SELECT value FROM settings WHERE key = $key", { key })?.value ?? 0);
  run(
    "INSERT INTO settings (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = $value",
    { key, value: String(used + units) }
  );
}

async function ytFetch<T>(endpoint: string, params: Record<string, string>, bucket: "data" | "search", retries = 3): Promise<T> {
  const key = requireApiKey();
  const { used, limit } = getQuotaUsage(bucket);
  if (used >= limit) throw new QuotaExceededError();

  const url = new URL(`${config.apiBaseUrl}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 429) throw new RateLimitedError();
      const body = (await res.json()) as T & { error?: { code: number; message: string; errors?: { reason: string }[] } };
      if (!res.ok) {
        const reason = body.error?.errors?.[0]?.reason ?? body.error?.message ?? res.statusText;
        if (reason === "quotaExceeded") throw new QuotaExceededError();
        throw new YoutubeApiError(body.error?.message ?? "YouTube API request failed", reason, res.status);
      }
      recordQuota(bucket, 1);
      return body;
    } catch (err) {
      if (err instanceof QuotaExceededError || err instanceof RateLimitedError) throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }
  throw new YoutubeApiError("Unreachable");
}

export function parseDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

interface RawVideo {
  id: string;
  snippet?: {
    channelId?: string;
    title?: string;
    description?: string;
    publishedAt?: string;
    defaultAudioLanguage?: string;
    categoryId?: string;
    tags?: string[];
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string; favoriteCount?: string };
}

interface RawChannel {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    country?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
  statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
  topicDetails?: { topicCategories?: string[] };
  brandingSettings?: { channel?: { keywords?: string } };
}

function toVideoInfo(v: RawVideo): VideoInfo {
  const thumb = v.snippet?.thumbnails;
  const url = thumb?.high?.url ?? thumb?.medium?.url ?? thumb?.default?.url ?? "";
  return {
    videoId: v.id,
    channelId: v.snippet?.channelId ?? "",
    title: v.snippet?.title ?? "",
    description: v.snippet?.description ?? "",
    publishedAt: v.snippet?.publishedAt ?? "",
    durationSeconds: parseDuration(v.contentDetails?.duration),
    thumbnailUrl: url,
    tags: v.snippet?.tags ?? [],
    categoryId: v.snippet?.categoryId ?? "",
    defaultLanguage: v.snippet?.defaultAudioLanguage ?? "",
    viewCount: Number(v.statistics?.viewCount ?? 0),
    likeCount: v.statistics?.likeCount != null ? Number(v.statistics.likeCount) : null,
    commentCount: v.statistics?.commentCount != null ? Number(v.statistics.commentCount) : null,
    lastFetched: Date.now(),
  };
}

function toChannelInfo(c: RawChannel): ChannelInfo {
  const thumb = c.snippet?.thumbnails;
  const url = thumb?.high?.url ?? thumb?.medium?.url ?? thumb?.default?.url ?? "";
  return {
    channelId: c.id,
    title: c.snippet?.title ?? "",
    description: c.snippet?.description ?? "",
    thumbnailUrl: url,
    customUrl: c.snippet?.customUrl ?? "",
    country: c.snippet?.country ?? "",
    publishedAt: c.snippet?.publishedAt ?? "",
    subscriberCount: Number(c.statistics?.subscriberCount ?? 0),
    videoCount: Number(c.statistics?.videoCount ?? 0),
    viewCount: Number(c.statistics?.viewCount ?? 0),
    channelTags: (c.brandingSettings?.channel?.keywords ?? "").split(/[\s,]+/).filter(Boolean),
    topicCategories: c.topicDetails?.topicCategories ?? [],
    lastFetched: Date.now(),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function upsertVideos(videos: VideoInfo[]) {
  const stmt = `
    INSERT INTO videos (
      video_id, channel_id, title, description, published_at, duration_seconds,
      thumbnail_url, default_language, view_count, like_count, comment_count, tags, category_id, last_fetched
    ) VALUES (
      $video_id, $channel_id, $title, $description, $published_at, $duration_seconds,
      $thumbnail_url, $default_language, $view_count, $like_count, $comment_count, $tags, $category_id, $last_fetched
    )
    ON CONFLICT(video_id) DO UPDATE SET
      channel_id = $channel_id, title = $title, description = $description, published_at = $published_at,
      duration_seconds = $duration_seconds, thumbnail_url = $thumbnail_url, default_language = $default_language,
      view_count = $view_count, like_count = $like_count, comment_count = $comment_count, tags = $tags,
      category_id = $category_id, last_fetched = $last_fetched
  `;
  for (const v of videos) {
    run(stmt, {
      video_id: v.videoId,
      channel_id: v.channelId,
      title: v.title,
      description: v.description,
      published_at: v.publishedAt,
      duration_seconds: v.durationSeconds,
      thumbnail_url: v.thumbnailUrl,
      default_language: v.defaultLanguage,
      view_count: v.viewCount,
      like_count: v.likeCount,
      comment_count: v.commentCount,
      tags: JSON.stringify(v.tags),
      category_id: v.categoryId,
      last_fetched: v.lastFetched,
    });
  }
}

function upsertChannels(channels: ChannelInfo[]) {
  const stmt = `
    INSERT INTO channels (
      channel_id, title, description, thumbnail_url, custom_url, country, published_at,
      subscriber_count, video_count, view_count, channel_tags, topic_categories, last_fetched
    ) VALUES (
      $channel_id, $title, $description, $thumbnail_url, $custom_url, $country, $published_at,
      $subscriber_count, $video_count, $view_count, $channel_tags, $topic_categories, $last_fetched
    )
    ON CONFLICT(channel_id) DO UPDATE SET
      title = $title, description = $description, thumbnail_url = $thumbnail_url, custom_url = $custom_url,
      country = $country, published_at = $published_at, subscriber_count = $subscriber_count,
      video_count = $video_count, view_count = $view_count, channel_tags = $channel_tags,
      topic_categories = $topic_categories, last_fetched = $last_fetched
  `;
  for (const c of channels) {
    run(stmt, {
      channel_id: c.channelId,
      title: c.title,
      description: c.description,
      thumbnail_url: c.thumbnailUrl,
      custom_url: c.customUrl,
      country: c.country,
      published_at: c.publishedAt,
      subscriber_count: c.subscriberCount,
      video_count: c.videoCount,
      view_count: c.viewCount,
      channel_tags: JSON.stringify(c.channelTags),
      topic_categories: JSON.stringify(c.topicCategories),
      last_fetched: c.lastFetched,
    });
  }
}

interface StoredVideo {
  video_id: string;
  channel_id: string;
  title: string;
  description: string;
  published_at: string;
  duration_seconds: number;
  thumbnail_url: string;
  default_language: string;
  view_count: number;
  like_count: number | null;
  comment_count: number | null;
  tags: string;
  category_id: string;
  last_fetched: number;
}

function storedVideoToInfo(row: StoredVideo): VideoInfo {
  return {
    videoId: row.video_id,
    channelId: row.channel_id,
    title: row.title,
    description: row.description,
    publishedAt: row.published_at,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    defaultLanguage: row.default_language,
    viewCount: row.view_count,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    tags: JSON.parse(row.tags || "[]"),
    categoryId: row.category_id,
    lastFetched: row.last_fetched,
  };
}

interface StoredChannel {
  channel_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  custom_url: string;
  country: string;
  published_at: string;
  subscriber_count: number;
  video_count: number;
  view_count: number;
  channel_tags: string;
  topic_categories: string;
  last_fetched: number;
}

function storedChannelToInfo(row: StoredChannel): ChannelInfo {
  return {
    channelId: row.channel_id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    customUrl: row.custom_url,
    country: row.country,
    publishedAt: row.published_at,
    subscriberCount: row.subscriber_count,
    videoCount: row.video_count,
    viewCount: row.view_count,
    channelTags: JSON.parse(row.channel_tags || "[]"),
    topicCategories: JSON.parse(row.topic_categories || "[]"),
    lastFetched: row.last_fetched,
  };
}

export async function fetchVideos(ids: string[]): Promise<VideoInfo[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const ttlCutoff = Date.now() - config.videoCacheTtlMs;

  const fresh = all<StoredVideo>(
    `SELECT * FROM videos WHERE video_id IN (${unique.map((_, i) => `$${i}`).join(",")}) AND last_fetched >= $cutoff`,
    {
      ...Object.fromEntries(unique.map((id, i) => [String(i), id])),
      cutoff: ttlCutoff,
    }
  );
  const freshIds = new Set(fresh.map((r) => r.video_id));
  const missing = unique.filter((id) => !freshIds.has(id));
  if (missing.length > 0) {
    for (const batch of chunk(missing, 50)) {
      const res = await ytFetch<{ items?: RawVideo[] }>("videos", {
        part: "snippet,contentDetails,statistics",
        id: batch.join(","),
        maxResults: "50",
      }, "data");
      upsertVideos((res.items ?? []).map(toVideoInfo));
    }
  }

  const allRows = all<StoredVideo>(
    `SELECT * FROM videos WHERE video_id IN (${unique.map((_, i) => `$${i}`).join(",")})`,
    Object.fromEntries(unique.map((id, i) => [String(i), id])) as Record<string, string>
  );
  return allRows.map(storedVideoToInfo);
}

/** Resolve a channel handle ("@handle") to a ChannelInfo via channels.list?forHandle=. */
export async function fetchChannelByHandle(handle: string): Promise<ChannelInfo | null> {
  const clean = handle.replace(/^@/, "");
  const res = await ytFetch<{ items?: RawChannel[] }>("channels", {
    part: "snippet,statistics,topicDetails,brandingSettings",
    forHandle: `@${clean}`,
    maxResults: "1",
  }, "data");
  const item = res.items?.[0];
  if (!item) return null;
  const info = toChannelInfo(item);
  upsertChannels([info]);
  return info;
}

export async function fetchChannels(ids: string[]): Promise<ChannelInfo[]> {  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const ttlCutoff = Date.now() - config.channelCacheTtlMs;

  const fresh = all<StoredChannel>(
    `SELECT * FROM channels WHERE channel_id IN (${unique.map((_, i) => `$${i}`).join(",")}) AND last_fetched >= $cutoff`,
    {
      ...Object.fromEntries(unique.map((id, i) => [String(i), id])),
      cutoff: ttlCutoff,
    }
  );
  const freshIds = new Set(fresh.map((r) => r.channel_id));
  const missing = unique.filter((id) => !freshIds.has(id));
  if (missing.length > 0) {
    for (const batch of chunk(missing, 50)) {
      const res = await ytFetch<{ items?: RawChannel[] }>("channels", {
        part: "snippet,statistics,topicDetails,brandingSettings",
        id: batch.join(","),
        maxResults: "50",
      }, "data");
      upsertChannels((res.items ?? []).map(toChannelInfo));
    }
  }

  const allRows = all<StoredChannel>(
    `SELECT * FROM channels WHERE channel_id IN (${unique.map((_, i) => `$${i}`).join(",")})`,
    Object.fromEntries(unique.map((id, i) => [String(i), id])) as Record<string, string>
  );
  return allRows.map(storedChannelToInfo);
}

/** Uploads playlist: UU + channelId.slice(2). Cheap (playlistItems.list, 1 unit/50). */
export async function fetchChannelUploadIds(channelId: string, maxResults = 50): Promise<string[]> {
  const uploadsPlaylist = `UU${channelId.slice(2)}`;
  const ids: string[] = [];
  let pageToken = "";
  do {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPlaylist,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;
    const res = await ytFetch<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>(
      "playlistItems", params, "data"
    );
    for (const item of res.items ?? []) {
      if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
      if (ids.length >= maxResults) return ids;
    }
    pageToken = res.nextPageToken ?? "";
  } while (pageToken);
  return ids;
}

interface SearchItem {
  id?: { videoId?: string; channelId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

export interface SearchOptions {
  maxResults?: number;
  order?: "relevance" | "viewCount" | "date" | "rating" | "title";
  publishedAfter?: string;
}

export async function searchVideos(q: string, opts: SearchOptions = {}): Promise<{
  items: { videoId: string; title: string; channelTitle: string; publishedAt: string; thumbnailUrl: string }[];
  nextPageToken?: string;
  quotaCost: number;
}> {
  const maxResults = Math.min(opts.maxResults ?? 20, 50);
  const params: Record<string, string> = {
    part: "snippet,statistics",
    type: "video",
    q,
    maxResults: String(maxResults),
    order: opts.order ?? "relevance",
    relevanceLanguage: "en",
  };
  if (opts.publishedAfter) params.publishedAfter = opts.publishedAfter;
  const res = await ytFetch<{ items?: SearchItem[]; nextPageToken?: string }>("search", params, "search");
  const items = (res.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: it.snippet?.title ?? "",
      channelTitle: it.snippet?.channelTitle ?? "",
      publishedAt: it.snippet?.publishedAt ?? "",
      thumbnailUrl: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.medium?.url ?? "",
    }));
  return { items, nextPageToken: res.nextPageToken, quotaCost: 1 };
}

/** Parse raw user input ("https://youtu.be/abc123" | "youtube.com/watch?v=..." | bare ID). */
export function parseVideoInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const watch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{6,})/);
  if (watch) return watch[1];
  if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Parse raw user input for a channel ("@handle", "youtube.com/@handle", "youtube.com/channel/UC...", bare channelId). */
export function parseChannelInput(raw: string): { type: "id" | "handle"; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const id = trimmed.match(/(?:youtube\.com\/channel\/)([a-zA-Z0-9_-]{6,})/);
  if (id) return { type: "id", value: id[1] };
  const handle = trimmed.match(/(?:youtube\.com\/@|^@)([a-zA-Z0-9_.-]+)/);
  if (handle) return { type: "handle", value: handle[1] };
  if (/^UC[a-zA-Z0-9_-]{6,}$/.test(trimmed)) return { type: "id", value: trimmed };
  return null;
}
