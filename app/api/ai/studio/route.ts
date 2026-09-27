import { fetchTranscript } from "@/lib/transcript";
import { runStudio } from "@/lib/aiStudio";
import type { StudioParams } from "@/lib/aiStudio";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ACTIONS = ["titles", "descriptions", "tags", "magicfill", "coach", "audit", "ideas"] as const;
const TRANSCRIPT_ACTIONS = new Set(["tags", "magicfill", "coach"]);

export async function POST(request: Request) {
  let body: Partial<StudioParams>;
  try {
    body = (await request.json()) as Partial<StudioParams>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !(ACTIONS as readonly string[]).includes(action)) {
    return Response.json({ error: "Unknown action. Use titles, descriptions, tags, magicfill, coach, audit, or ideas." }, { status: 400 });
  }

  const params: StudioParams = {
    action,
    videoId: body.videoId,
    channelId: body.channelId,
    title: body.title,
    description: body.description,
    tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : undefined,
    transcript: body.transcript,
    query: body.query,
    context: body.context,
    keyword: body.keyword,
  };

  if (TRANSCRIPT_ACTIONS.has(action as (typeof ACTIONS)[number]) && !params.transcript && params.videoId) {
    try {
      const transcript = await fetchTranscript(params.videoId);
      if (transcript) params.transcript = transcript;
    } catch {
      // transcript is optional; generation falls back to title + description only
    }
  }

  try {
    const result = await runStudio(params);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "AI request failed" },
      { status: 500 }
    );
  }
}