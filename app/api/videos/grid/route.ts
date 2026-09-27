import { fetchChannels, fetchVideos, YoutubeApiError } from "@/lib/youtubeClient";
import { buildGridRow, type GridChannelContext } from "@/lib/gridRows";
import { channelAverageViews } from "@/lib/outlier";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 50 ids is exactly one videos.list call, so a full page of cards costs 1 unit. */
const MAX_IDS = 50;
const VIDEO_ID = /^[\w-]{11}$/;

export async function POST(request: Request) {
  let body: { ids?: unknown } = {};
  try {
    body = (await request.json()) as { ids?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.ids)) {
    return Response.json({ error: "Send { ids: string[] } — up to 50 video ids." }, { status: 400 });
  }

  const ids = [...new Set(body.ids.filter((id): id is string => typeof id === "string" && VIDEO_ID.test(id)))].slice(0, MAX_IDS);
  if (ids.length === 0) {
    return Response.json({ error: "No usable video ids in that request." }, { status: 400 });
  }

  try {
    // fetchVideos and fetchChannels both read their own TTL cache first, so
    // re-scrolling a page costs no quota at all. The channel round-trip is a
    // second unit per 50 cards and buys the subscriber count and the average
    // every outlier is measured against.
    const videos = await fetchVideos(ids);
    const channelIds = [...new Set(videos.map((video) => video.channelId).filter(Boolean))];
    let contextById = new Map<string, GridChannelContext>();
    try {
      const channels = channelIds.length > 0 ? await fetchChannels(channelIds.slice(0, MAX_IDS)) : [];
      contextById = new Map(
        channels.map((channel) => [
          channel.channelId,
          { subscriberCount: channel.subscriberCount, averageViews: channelAverageViews(channel) }
        ])
      );
    } catch {
      // Subscriber counts and outliers are additions to a page of cards, not
      // the page itself: ship the video rows without them.
      contextById = new Map();
    }

    return Response.json({
      kind: "grid",
      rows: videos.map((video) => buildGridRow(video, undefined, video.channelId ? contextById.get(video.channelId) ?? null : null))
    });
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Grid lookup failed" }, { status: 500 });
  }
}
