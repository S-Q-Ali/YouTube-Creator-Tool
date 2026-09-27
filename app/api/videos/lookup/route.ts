import { fetchChannels, fetchVideos, parseVideoInput, YoutubeApiError } from "@/lib/youtubeClient";
import { computeSeoScore } from "@/lib/scorecard";
import { computeVph } from "@/lib/vphEngine";
import { computeVelocity } from "@/lib/velocity";
import { isTracked } from "@/lib/tracking";
import { all } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  url?: string;
  focusKeyword?: string;
}

/** Channel-avg views from locally persisted snapshots (no extra API quota). */
function channelContext(channelId: string, videoId: string) {
  const rows = all<{ view_count: number | null }>(
    "SELECT view_count FROM videos WHERE channel_id = $c AND video_id != $v AND view_count IS NOT NULL",
    { $c: channelId, $v: videoId }
  );
  const views = rows.map((r) => r.view_count ?? 0).filter((v) => v > 0);
  if (views.length === 0) return null;
  const avg = views.reduce((a, b) => a + b, 0) / views.length;
  return { channelAvgViews: Math.round(avg), watchedVideos: views.length };
}

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const videoId = parseVideoInput(body.url ?? "");
  if (!videoId) {
    return Response.json(
      { error: "Couldn't find a video ID in that input. Try a youtube.com/watch?v=…, youtu.be/…, or a bare 11-char ID." },
      { status: 400 }
    );
  }

  try {
    const [video] = await fetchVideos([videoId]);
    if (!video) {
      return Response.json({ error: `No video found for id "${videoId}".` }, { status: 404 });
    }

    const channel = video.channelId ? (await fetchChannels([video.channelId]))[0] : undefined;
    const seo = computeSeoScore({
      title: video.title,
      description: video.description,
      tags: video.tags,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      publishedAt: video.publishedAt,
      focusKeyword: body.focusKeyword?.trim() || undefined,
    });
    const vph = computeVph(video.videoId);
    const velocity = computeVelocity({ viewCount: video.viewCount, publishedAt: video.publishedAt });
    const ctx = channel && video.channelId ? channelContext(video.channelId, video.videoId) : null;
    const outlier = ctx && ctx.channelAvgViews > 0 ? Math.round((video.viewCount / ctx.channelAvgViews) * 100) : null;

    return Response.json({
      kind: "video",
      video,
      channel: channel
        ? { channelId: channel.channelId, title: channel.title, thumbnailUrl: channel.thumbnailUrl, subscriberCount: channel.subscriberCount }
        : undefined,
      seo,
      vph,
      velocity,
      channelContext: ctx,
      outlier,
      tracked: isTracked("video", video.videoId),
    });
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Lookup failed" }, { status: 500 });
  }
}
