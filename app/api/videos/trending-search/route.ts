import { searchWithYtdlp } from "@/lib/ytdlpSearch";
import { fetchVideos, YoutubeApiError } from "@/lib/youtubeClient";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body {
  term?: string;
  maxResults?: number;
}

/** Free yt-dlp niche search (no API quota) + view counts via videos.list. */
export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const term = (body.term ?? "").trim();
  if (!term) {
    return Response.json({ error: "Missing 'term'" }, { status: 400 });
  }

  const max = Math.max(3, Math.min(body.maxResults || 8, 12));
  const search = await searchWithYtdlp(term, max);
  const found = (search?.items || []).slice(0, max);

  if (found.length === 0) {
    return Response.json({ items: [], notice: "yt-dlp couldn't find videos for this search." });
  }

  const ids = found.map((v) => v.videoId);
  const byId = new Map<string, number>();
  try {
    const videos = await fetchVideos(ids);
    for (const v of videos) {
      if (v.viewCount != null) byId.set(v.videoId, v.viewCount);
    }
  } catch (err) {
    // Views are a nice-to-have; keep going if the quota is exhausted.
    return Response.json({
      items: found.map((v) => ({ videoId: v.videoId, title: v.title, channelTitle: v.channelTitle, durationSeconds: v.durationSeconds })),
      notice: err instanceof YoutubeApiError ? "Views unavailable — YouTube quota check failed." : "Views unavailable.",
    });
  }

  const items = found
    .map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      durationSeconds: v.durationSeconds,
      viewCount: byId.get(v.videoId) ?? null,
    }))
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

  return Response.json({ items });
}