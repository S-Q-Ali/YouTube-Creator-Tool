import { all, get, run } from "./db";
import { fetchChannels, fetchVideos, ytFetch, getQuotaUsage, QuotaExceededError, RateLimitedError } from "./youtubeClient";
import type { ChannelInfo, VideoInfo } from "./types";

export interface TrendingChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  publishedAt: string;
  videoFormat: string;
  niche: string;
  categoryName: string;
  viralScore: number;
  growthRate: number;
  viewSubRatio: number;
  recentVideoCount: number;
  avgViewsPerVideo: number;
  isNewlyCreated: boolean;
}

export interface VideoFormat {
  id: string;
  name: string;
  ratio: string;
}

export interface Niche {
  id: string;
  name: string;
  queries: string[];
}

export const VIDEO_FORMATS: VideoFormat[] = [
  { id: "longform", name: "Long Form", ratio: "16:9" },
  { id: "shortform", name: "Short Form", ratio: "9:16" },
];

export const FORMAT_NICHES: Record<string, Niche[]> = {
  longform: [
    { id: "ai_tech", name: "AI & Tech", queries: ["AI tutorial", "tech review 2026", "AI tools guide", "machine learning tutorial"] },
    { id: "finance", name: "Finance & Investing", queries: ["investing tutorial", "personal finance guide", "stock market explained", "crypto tutorial"] },
    { id: "education", name: "Education", queries: ["how to tutorial", "learn explained", "educational guide", "deep dive explained"] },
    { id: "documentary", name: "Documentary", queries: ["documentary full", "investigative documentary", "true story documentary"] },
    { id: "diy_crafts", name: "DIY & Crafts", queries: ["DIY project tutorial", "woodworking project", "craft tutorial", "home improvement"] },
    { id: "cooking", name: "Cooking & Recipes", queries: ["cooking recipe tutorial", "baking recipe", "cooking full video", "chef tutorial"] },
    { id: "fitness_health", name: "Fitness & Health", queries: ["workout tutorial", "fitness guide", "health tips", "nutrition guide"] },
    { id: "gaming", name: "Gaming", queries: ["gaming walkthrough", "game review 2026", "gameplay full", "gaming tutorial"] },
    { id: "business", name: "Business & Entrepreneurship", queries: ["business case study", "startup story", "entrepreneur tutorial", "business strategy"] },
    { id: "true_crime", name: "True Crime", queries: ["true crime documentary", "unsolved case", "criminal psychology", "mystery investigation"] },
    { id: "space_science", name: "Space & Science", queries: ["space documentary", "astronomy explained", "science deep dive", "NASA documentary"] },
    { id: "self_improvement", name: "Self-Improvement", queries: ["stoicism tutorial", "self improvement guide", "mental health tips", "productivity guide"] },
    { id: "ai_faceless", name: "AI Faceless Channels", queries: ["faceless channel tutorial", "AI voiceover channel", "faceless YouTube automation", "no face channel"] },
  ],
  shortform: [
    { id: "entertainment", name: "Entertainment", queries: ["shorts viral", "shorts funny", "shorts trending", "entertainment shorts"] },
    { id: "food_drink", name: "Food & Drink", queries: ["shorts food", "recipe shorts", "cooking shorts", "food review shorts"] },
    { id: "gaming", name: "Gaming", queries: ["gaming shorts", "Roblox shorts", "Minecraft shorts", "game clip shorts"] },
    { id: "sports", name: "Sports", queries: ["sports highlights", "sports moments", "athletic shorts", "action sports"] },
    { id: "crafting", name: "Crafting & DIY", queries: ["craft shorts", "DIY shorts", "satisfying craft", "art process shorts"] },
    { id: "comedy", name: "Comedy & Skits", queries: ["funny shorts", "comedy shorts", "skit shorts", "humor shorts"] },
    { id: "dance_challenges", name: "Dance & Challenges", queries: ["dance shorts", "viral challenge", "trending dance", "challenge shorts"] },
    { id: "motivation", name: "Motivation", queries: ["motivational shorts", "inspirational quotes", "self improvement shorts"] },
    { id: "finance_tips", name: "Finance Tips", queries: ["money tips shorts", "investing shorts", "financial advice shorts"] },
    { id: "tech_ai", name: "Tech & AI News", queries: ["tech news shorts", "AI news shorts", "gadget review shorts"] },
    { id: "facts_trivia", name: "Did You Know Facts", queries: ["did you know shorts", "fun facts shorts", "amazing facts", "educational shorts"] },
    { id: "scary_stories", name: "Scary Stories", queries: ["horror shorts", "scary story shorts", "creepy shorts", "horror story"] },
    { id: "commentary", name: "Commentary", queries: ["commentary shorts", "reaction shorts", "viral clip reaction"] },
    { id: "animals", name: "Animals & Pets", queries: ["cute animals shorts", "funny animals", "pet shorts", "animal facts shorts"] },
    { id: "cars", name: "Cars & Racing", queries: ["car shorts", "supercar shorts", "racing shorts", "car review shorts"] },
    { id: "animation", name: "Animation", queries: ["animation shorts", "2D animation shorts", "3D animation shorts", "animated shorts"] },
    { id: "news", name: "News & Current Events", queries: ["news shorts", "breaking news shorts", "current events shorts"] },
    { id: "asmr", name: "ASMR", queries: ["ASMR shorts", "satisfying shorts", "relaxing shorts", "oddly satisfying"] },
    { id: "beauty_fashion", name: "Beauty & Fashion", queries: ["makeup shorts", "fashion shorts", "outfit ideas", "beauty tips shorts"] },
    { id: "family", name: "Family & Parenting", queries: ["family shorts", "parenting shorts", "baby shorts", "family moments"] },
  ],
};

export const YOUTUBE_CATEGORIES: { id: string; name: string; order: number }[] = [
  { id: "faceless", name: "AI Faceless Channels", order: 0 },
  { id: "longform", name: "Long Form Channels", order: 0.5 },
  { id: "shortform", name: "Short Form Channels", order: 0.6 },
  { id: "1", name: "Film & Animation", order: 1 },
  { id: "2", name: "Autos & Vehicles", order: 2 },
  { id: "10", name: "Music", order: 3 },
  { id: "15", name: "Pets & Animals", order: 4 },
  { id: "17", name: "Sports", order: 5 },
  { id: "18", name: "Short Movies", order: 6 },
  { id: "19", name: "Travel & Events", order: 7 },
  { id: "20", name: "Gaming", order: 8 },
  { id: "21", name: "Videoblogging", order: 9 },
  { id: "22", name: "People & Blogs", order: 10 },
  { id: "23", name: "Comedy", order: 11 },
  { id: "24", name: "Entertainment", order: 12 },
  { id: "25", name: "News & Politics", order: 13 },
  { id: "26", name: "Howto & Style", order: 14 },
  { id: "27", name: "Education", order: 15 },
  { id: "28", name: "Science & Technology", order: 16 },
  { id: "29", name: "Nonprofits & Activism", order: 17 },
  { id: "30", name: "Movies", order: 18 },
  { id: "31", name: "Anime / Animation", order: 19 },
  { id: "32", name: "Action / Adventure", order: 20 },
  { id: "33", name: "Classics", order: 21 },
  { id: "34", name: "Comedy", order: 22 },
  { id: "35", name: "Documentary", order: 23 },
  { id: "36", name: "Drama", order: 24 },
  { id: "37", name: "Family", order: 25 },
  { id: "38", name: "Foreign", order: 26 },
  { id: "39", name: "Horror", order: 27 },
  { id: "40", name: "Sci-Fi / Fantasy", order: 28 },
  { id: "41", name: "Thriller", order: 29 },
  { id: "42", name: "Shorts", order: 30 },
  { id: "43", name: "Shows", order: 31 },
  { id: "44", name: "Trailers", order: 32 },
];

function isNewlyCreated(publishedAt: string): boolean {
  const created = new Date(publishedAt);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return created > sixMonthsAgo;
}

function calculateViralScore(
  channel: ChannelInfo,
  videos: VideoInfo[]
): number {
  const viewSubRatio = channel.viewCount / Math.max(channel.subscriberCount, 1);
  const avgViewsPerVideo = channel.viewCount / Math.max(channel.videoCount, 1);

  let totalEngagement = 0;
  let videoCount = 0;
  for (const video of videos.slice(0, 10)) {
    if (video.likeCount != null && video.commentCount != null && video.viewCount > 0) {
      totalEngagement += (video.likeCount + video.commentCount) / video.viewCount;
      videoCount++;
    }
  }
  const engagementRate = videoCount > 0 ? totalEngagement / videoCount : 0;

  const created = new Date(channel.publishedAt);
  const monthsOld = (Date.now() - created.getTime()) / (30 * 24 * 60 * 60 * 1000);
  const freshnessScore = Math.max(0, 100 - monthsOld * 5);

  const score =
    Math.min(viewSubRatio * 30, 30) +
    Math.min(avgViewsPerVideo / 10000, 25) +
    Math.min(engagementRate * 250, 25) +
    Math.min(freshnessScore, 20);

  return Math.round(Math.min(score, 100));
}

function calculateGrowthRate(videos: VideoInfo[]): number {
  if (videos.length < 2) return 0;
  const sorted = [...videos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const recent = sorted.slice(0, Math.ceil(sorted.length / 2));
  const older = sorted.slice(Math.ceil(sorted.length / 2));

  const recentAvg = recent.reduce((sum, v) => sum + v.viewCount, 0) / recent.length;
  const olderAvg = older.reduce((sum, v) => sum + v.viewCount, 0) / Math.max(older.length, 1);

  if (olderAvg === 0) return recentAvg > 0 ? 100 : 0;
  return Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
}

export async function discoverTrendingChannels(
  videoFormat: string,
  niche: string,
  maxResults = 50
): Promise<{ channels: TrendingChannel[]; searchesUsed: number }> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const publishedAfter = oneWeekAgo.toISOString();

  const nicheData = FORMAT_NICHES[videoFormat]?.find(n => n.id === niche);
  if (!nicheData) {
    console.error(`Niche ${niche} not found for format ${videoFormat}`);
    return { channels: [], searchesUsed: 0 };
  }

  const searchQueries = nicheData.queries;
  const allChannels: TrendingChannel[] = [];

  let searchesUsed = 0;
  const SEARCH_BUDGET = 80;

  for (const query of searchQueries) {
    const { used, limit } = getQuotaUsage("search");
    if (used >= SEARCH_BUDGET) {
      console.log(`Search budget exhausted (${used}/${SEARCH_BUDGET}), stopping discovery for ${videoFormat}/${niche}`);
      break;
    }

    try {
      const searchRes = await ytFetch<{ items?: Array<{ id?: { videoId?: string } }> }>(
        "search",
        {
          part: "snippet",
          type: "video",
          q: query,
          order: "viewCount",
          publishedAfter,
          maxResults: String(Math.min(maxResults, 50)),
        },
        "search"
      );
      searchesUsed++;

      const videoIds = (searchRes.items ?? [])
        .map((item) => item.id?.videoId)
        .filter(Boolean) as string[];

        if (videoIds.length === 0) continue;

      const videos = await fetchVideos(videoIds);

      const filteredVideos = videoFormat === "longform"
        ? videos.filter((v) => v.durationSeconds && v.durationSeconds >= 480)
        : videos.filter((v) => !v.durationSeconds || v.durationSeconds <= 60);

      const channelIds = [...new Set(filteredVideos.map((v) => v.channelId).filter(Boolean))];

      if (channelIds.length === 0) continue;

      const channels = await fetchChannels(channelIds);

      const channelVideoMap = new Map<string, VideoInfo[]>();
      for (const video of filteredVideos) {
        const existing = channelVideoMap.get(video.channelId) || [];
        existing.push(video);
        channelVideoMap.set(video.channelId, existing);
      }

      for (const channel of channels) {
        const channelVideos = channelVideoMap.get(channel.channelId) || [];
        if (channelVideos.length === 0) continue;

        const viralScore = calculateViralScore(channel, channelVideos);
        const growthRate = calculateGrowthRate(channelVideos);
        const viewSubRatio = channel.viewCount / Math.max(channel.subscriberCount, 1);
        const avgViewsPerVideo = channel.viewCount / Math.max(channel.videoCount, 1);

        allChannels.push({
          channelId: channel.channelId,
          title: channel.title,
          description: channel.description,
          thumbnailUrl: channel.thumbnailUrl,
          subscriberCount: channel.subscriberCount,
          viewCount: channel.viewCount,
          videoCount: channel.videoCount,
          publishedAt: channel.publishedAt,
          videoFormat,
          niche,
          categoryName: nicheData.name,
          viralScore,
          growthRate,
          viewSubRatio,
          recentVideoCount: channelVideos.length,
          avgViewsPerVideo,
          isNewlyCreated: isNewlyCreated(channel.publishedAt),
        });
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        console.log(`Quota exceeded during discovery for ${videoFormat}/${niche}, stopping`);
        throw err;
      }
      if (err instanceof RateLimitedError) {
        console.log(`Rate limited during discovery for ${videoFormat}/${niche}, retrying after delay...`);
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      console.error(`Search error for ${videoFormat}/${niche} (query: ${query}):`, err);
      continue;
    }
  }

  const uniqueChannels = Array.from(
    new Map(allChannels.map((ch) => [ch.channelId, ch])).values()
  );

  uniqueChannels.sort((a, b) => b.viralScore - a.viralScore);

  return { channels: uniqueChannels.slice(0, 20), searchesUsed };
}

export function saveTrendingChannels(channels: TrendingChannel[]) {
  const stmt = `
    INSERT INTO trending_channels (
      channel_id, title, description, thumbnail_url, subscriber_count,
      view_count, video_count, published_at, video_format, niche, category_name,
      discovered_at, viral_score, growth_rate, view_sub_ratio,
      recent_video_count, avg_views_per_video, is_newly_created, last_analyzed
    ) VALUES (
      $channel_id, $title, $description, $thumbnail_url, $subscriber_count,
      $view_count, $video_count, $published_at, $video_format, $niche, $category_name,
      $discovered_at, $viral_score, $growth_rate, $view_sub_ratio,
      $recent_video_count, $avg_views_per_video, $is_newly_created, $last_analyzed
    )
    ON CONFLICT(channel_id) DO UPDATE SET
      title = $title, description = $description, thumbnail_url = $thumbnail_url,
      subscriber_count = $subscriber_count, view_count = $view_count,
      video_count = $video_count, published_at = $published_at,
      video_format = $video_format, niche = $niche, category_name = $category_name,
      discovered_at = $discovered_at, viral_score = $viral_score,
      growth_rate = $growth_rate, view_sub_ratio = $view_sub_ratio,
      recent_video_count = $recent_video_count, avg_views_per_video = $avg_views_per_video,
      is_newly_created = $is_newly_created, last_analyzed = $last_analyzed
  `;

  const now = Date.now();
  for (const ch of channels) {
    run(stmt, {
      channel_id: ch.channelId,
      title: ch.title,
      description: ch.description,
      thumbnail_url: ch.thumbnailUrl,
      subscriber_count: ch.subscriberCount,
      view_count: ch.viewCount,
      video_count: ch.videoCount,
      published_at: ch.publishedAt,
      video_format: ch.videoFormat,
      niche: ch.niche,
      category_name: ch.categoryName,
      discovered_at: now,
      viral_score: ch.viralScore,
      growth_rate: ch.growthRate,
      view_sub_ratio: ch.viewSubRatio,
      recent_video_count: ch.recentVideoCount,
      avg_views_per_video: Math.round(ch.avgViewsPerVideo),
      is_newly_created: ch.isNewlyCreated ? 1 : 0,
      last_analyzed: 0,
    });
  }
}

export function getTrendingChannels(
  videoFormat?: string,
  niche?: string,
  limit = 20,
  offset = 0
): TrendingChannel[] {
  const selectColumns = `
    channel_id AS channelId,
    title,
    description,
    thumbnail_url AS thumbnailUrl,
    subscriber_count AS subscriberCount,
    view_count AS viewCount,
    video_count AS videoCount,
    published_at AS publishedAt,
    video_format AS videoFormat,
    niche,
    category_name AS categoryName,
    viral_score AS viralScore,
    growth_rate AS growthRate,
    view_sub_ratio AS viewSubRatio,
    recent_video_count AS recentVideoCount,
    avg_views_per_video AS avgViewsPerVideo,
    is_newly_created AS isNewlyCreated,
    last_analyzed AS lastAnalyzed
  `;
  let sql = `SELECT ${selectColumns} FROM trending_channels`;
  const params: Record<string, string | number> = {};
  const conditions: string[] = [];

  if (videoFormat && videoFormat !== "all") {
    conditions.push("video_format = $video_format");
    params.video_format = videoFormat;
  }
  if (niche && niche !== "all") {
    conditions.push("niche = $niche");
    params.niche = niche;
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY viral_score DESC LIMIT $limit OFFSET $offset";
  params.limit = limit;
  params.offset = offset;

  return all<TrendingChannel>(sql, params);
}

export function getTrendingChannelCount(videoFormat?: string, niche?: string): number {
  let sql = "SELECT COUNT(*) as count FROM trending_channels";
  const params: Record<string, string | number> = {};
  const conditions: string[] = [];

  if (videoFormat && videoFormat !== "all") {
    conditions.push("video_format = $video_format");
    params.video_format = videoFormat;
  }
  if (niche && niche !== "all") {
    conditions.push("niche = $niche");
    params.niche = niche;
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  return get<{ count: number }>(sql, params)?.count ?? 0;
}

export function getFormatNicheCounts(): { videoFormat: string; niche: string; count: number }[] {
  return all<{ video_format: string; niche: string; count: number }>(
    "SELECT video_format, niche, COUNT(*) as count FROM trending_channels GROUP BY video_format, niche"
  ).map((r) => ({ videoFormat: r.video_format, niche: r.niche, count: r.count }));
}

export function getTrendingChannelById(channelId: string): TrendingChannel | null {
  return get<TrendingChannel>(
    `SELECT 
      channel_id AS channelId,
      title,
      description,
      thumbnail_url AS thumbnailUrl,
      subscriber_count AS subscriberCount,
      view_count AS viewCount,
      video_count AS videoCount,
      published_at AS publishedAt,
      category_id AS categoryId,
      category_name AS categoryName,
      viral_score AS viralScore,
      growth_rate AS growthRate,
      view_sub_ratio AS viewSubRatio,
      recent_video_count AS recentVideoCount,
      avg_views_per_video AS avgViewsPerVideo,
      is_newly_created AS isNewlyCreated,
      last_analyzed AS lastAnalyzed
    FROM trending_channels WHERE channel_id = $channel_id`,
    { channel_id: channelId }
  ) ?? null;
}

export function logDiscovery(videoFormat: string, niche: string, channelsFound: number, searchesUsed: number) {
  run(
    `INSERT INTO discovery_log (video_format, niche, channels_found, searches_used, discovered_at)
     VALUES ($video_format, $niche, $channels_found, $searches_used, $discovered_at)`,
    {
      video_format: videoFormat,
      niche,
      channels_found: channelsFound,
      searches_used: searchesUsed,
      discovered_at: Date.now(),
    }
  );
}

export function wasNicheDiscoveredRecently(videoFormat: string, niche: string, withinMs = 24 * 60 * 60 * 1000): boolean {
  const row = get<{ discovered_at: number }>(
    `SELECT discovered_at FROM discovery_log
     WHERE video_format = $video_format AND niche = $niche AND channels_found > 0
     ORDER BY discovered_at DESC LIMIT 1`,
    { video_format: videoFormat, niche }
  );
  if (!row) return false;
  return Date.now() - row.discovered_at < withinMs;
}

export function getDiscoveryStatus(): { videoFormat: string; niche: string; lastDiscoveredAt: number; channelsFound: number }[] {
  return all<{ video_format: string; niche: string; discovered_at: number; channels_found: number }>(
    `SELECT d.video_format, d.niche, d.discovered_at, d.channels_found
     FROM discovery_log d
     INNER JOIN (
       SELECT video_format, niche, MAX(discovered_at) as max_at
       FROM discovery_log
       GROUP BY video_format, niche
     ) latest ON d.video_format = latest.video_format AND d.niche = latest.niche AND d.discovered_at = latest.max_at`
  ).map(r => ({
    videoFormat: r.video_format,
    niche: r.niche,
    lastDiscoveredAt: r.discovered_at,
    channelsFound: r.channels_found,
  }));
}

export async function refreshAllTrending(
  videoFormat?: string,
  niche?: string
): Promise<{ discovered: number; niches: number; searchesUsed: number }> {
  let totalDiscovered = 0;
  let nichesScanned = 0;
  let totalSearchesUsed = 0;

  const formatsToScan = videoFormat 
    ? VIDEO_FORMATS.filter(f => f.id === videoFormat)
    : VIDEO_FORMATS;

  for (const format of formatsToScan) {
    const nichesToScan = niche
      ? FORMAT_NICHES[format.id]?.filter(n => n.id === niche) || []
      : FORMAT_NICHES[format.id] || [];

    for (const n of nichesToScan) {
      if (wasNicheDiscoveredRecently(format.id, n.id)) {
        console.log(`Skipping ${format.name}/${n.name} - discovered recently (within 24h)`);
        continue;
      }

      try {
        const result = await discoverTrendingChannels(format.id, n.id, 50);
        const channels = Array.isArray(result) ? result : result.channels;
        const searchesUsed = Array.isArray(result) ? 0 : result.searchesUsed;
        saveTrendingChannels(channels);
        if (channels.length > 0) {
          logDiscovery(format.id, n.id, channels.length, searchesUsed);
        }
        totalDiscovered += channels.length;
        totalSearchesUsed += searchesUsed;
        nichesScanned++;
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          console.log(`Quota exhausted, stopping all discovery`);
          throw err;
        }
        console.error(`Failed to discover channels for ${format.name}/${n.name}:`, err);
      }
    }
  }

  return { discovered: totalDiscovered, niches: nichesScanned, searchesUsed: totalSearchesUsed };
}
