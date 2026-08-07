import { fetchChannels, fetchVideos, parseVideoInput, YoutubeApiError } from "@/lib/youtubeClient";
import { computeSeoScore } from "@/lib/scorecard";
import { computeVph } from "@/lib/vphEngine";
import { isTracked } from "@/lib/tracking";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  url?: string;
  focusKeyword?: string;
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

    return Response.json({
      kind: "video",
      video,
      channel: channel
        ? { channelId: channel.channelId, title: channel.title, thumbnailUrl: channel.thumbnailUrl, subscriberCount: channel.subscriberCount }
        : undefined,
      seo,
      vph,
      tracked: isTracked("video", video.videoId),
    });
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Lookup failed" }, { status: 500 });
  }
}
