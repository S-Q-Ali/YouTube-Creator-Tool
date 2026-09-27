import { fetchVideos, parseVideoInput, YoutubeApiError } from "@/lib/youtubeClient";
import { getCachedKeywords } from "@/lib/keywordEngine";
import { scoreTag } from "@/lib/aiStudio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Video tags with heuristic scores + top gap-suggestions from the keyword vault. */
export async function GET(request: Request) {
  const videoId = parseVideoInput(new URL(request.url).searchParams.get("videoId") ?? "");
  if (!videoId) {
    return Response.json({ error: "No video ID found in query." }, { status: 400 });
  }

  try {
    const [video] = await fetchVideos([videoId]);
    if (!video) {
      return Response.json({ error: `No video found for id "${videoId}".` }, { status: 404 });
    }

    const tags = (video.tags || []).map((t) => ({ tag: t, score: scoreTag(t, undefined, video.title) }));
    const existing = new Set(tags.map((t) => t.tag.toLowerCase()));

    const vault = getCachedKeywords("", 20);
    const additions = vault
      .filter((k) => !existing.has(k.term.toLowerCase()))
      .map((k) => ({ tag: k.term, score: scoreTag(k.term, undefined, video.title) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return Response.json({ videoId, tags, additions });
  } catch (err) {
    if (err instanceof YoutubeApiError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Tags lookup failed" }, { status: 500 });
  }
}