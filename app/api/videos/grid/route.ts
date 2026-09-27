import { fetchVideos, YoutubeApiError } from "@/lib/youtubeClient";
import { buildGridRow } from "@/lib/gridRows";

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
    // fetchVideos reads its own TTL cache first, so re-scrolling a page costs no
    // quota at all.
    const videos = await fetchVideos(ids);
    return Response.json({ kind: "grid", rows: videos.map((video) => buildGridRow(video)) });
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Grid lookup failed" }, { status: 500 });
  }
}
