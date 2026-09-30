import { all, now } from "@/lib/db";
import { buildSeries, clampDays, DAY_MS, type Snapshot } from "@/lib/videoHistory";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A video's view history, from the snapshots this app already takes.
 *
 * This route spends no YouTube quota: it reads a table the poller is already
 * writing. The limit worth knowing is that a video only gets rows once someone
 * tracks it, so the response says how much cover it found rather than
 * returning an empty series a chart would draw as a flat line.
 */

const VIDEO_ID = /^[\w-]{11}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const videoId = url.searchParams.get("videoId") ?? "";
  if (!VIDEO_ID.test(videoId)) {
    return Response.json(
      { error: "Send videoId as the 11-character YouTube id, e.g. dQw4w9WgXcQ." },
      { status: 400 }
    );
  }

  // The raw string goes in, not Number(...): an absent parameter would arrive as
  // 0 and clamp to a single day.
  const days = clampDays(url.searchParams.get("days"));
  const rows = all<Snapshot>(
    `SELECT ts, view_count, like_count
       FROM video_snapshots
      WHERE video_id = $id AND ts >= $from
      ORDER BY ts ASC`,
    { $id: videoId, $from: now() - days * DAY_MS }
  );

  return Response.json({ kind: "history", days, ...buildSeries(videoId, rows) });
}
