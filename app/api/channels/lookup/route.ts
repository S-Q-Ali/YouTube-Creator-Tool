import { fetchChannelByHandle, fetchChannels, fetchChannelUploadIds, fetchVideos, parseChannelInput, YoutubeApiError } from "@/lib/youtubeClient";
import { computeChannelSeoScore } from "@/lib/scorecard";
import { isTracked } from "@/lib/tracking";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface Body {
  url?: string;
}

export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseChannelInput(body.url ?? "");
  if (!parsed) {
    return Response.json(
      { error: "Couldn't find a channel in that input. Try youtube.com/@handle, youtube.com/channel/UC…, or a bare channel ID." },
      { status: 400 }
    );
  }

  try {
    const channel = parsed.type === "handle"
      ? await fetchChannelByHandle(parsed.value)
      : (await fetchChannels([parsed.value]))[0];

    if (!channel) {
      return Response.json({ error: "Channel not found." }, { status: 404 });
    }

    const seo = computeChannelSeoScore(channel);

    const uploadIds = await fetchChannelUploadIds(channel.channelId, 20);
    const recentVideos = uploadIds.length > 0 ? await fetchVideos(uploadIds) : [];

    return Response.json({
      kind: "channel",
      channel,
      seo,
      recentVideos: recentVideos
        .map((v) => ({
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
          viewCount: v.viewCount,
          durationSeconds: v.durationSeconds,
        }))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
      tracked: isTracked("channel", channel.channelId),
    });
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Lookup failed" }, { status: 500 });
  }
}
