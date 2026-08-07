/**
 * Background poller: snapshots tracked videos/channels into SQLite so we can
 * compute Views Per Hour, subscriber growth, and upload cadence over time.
 *
 * Run alongside `next dev` via `npm run dev:full` (concurrently) or standalone:
 *   npm run poller
 */
import { all, now, run } from "../lib/db";
import { fetchVideos, fetchChannels } from "../lib/youtubeClient";

const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 3600000);

async function snapshotTrackedVideos() {
  const tracked = all<{ ref_id: string }>("SELECT ref_id FROM tracked_items WHERE kind = 'video'");
  if (tracked.length === 0) return;
  const ids = tracked.map((t) => t.ref_id);
  const videos = await fetchVideos(ids);
  const ts = now();
  const tsBucket = Math.floor(ts / 600000) * 600000; // dedupe within 10-min window
  for (const v of videos) {
    run(
      `INSERT OR IGNORE INTO video_snapshots (video_id, ts, view_count, like_count, comment_count)
       VALUES ($video_id, $ts, $view_count, $like_count, $comment_count)`,
      {
        video_id: v.videoId,
        ts: tsBucket,
        view_count: v.viewCount,
        like_count: v.likeCount,
        comment_count: v.commentCount,
      }
    );
  }
  console.log(`[poller] snapshotted ${videos.length} videos at ${new Date(ts).toISOString()}`);
}

async function snapshotTrackedChannels() {
  const tracked = all<{ ref_id: string }>("SELECT ref_id FROM tracked_items WHERE kind = 'channel'");
  if (tracked.length === 0) return;
  const ids = tracked.map((t) => t.ref_id);
  const channels = await fetchChannels(ids);
  const ts = now();
  const tsBucket = Math.floor(ts / 600000) * 600000;
  for (const c of channels) {
    run(
      `INSERT OR IGNORE INTO channel_snapshots (channel_id, ts, subscriber_count, video_count, view_count)
       VALUES ($channel_id, $ts, $subscriber_count, $video_count, $view_count)`,
      {
        channel_id: c.channelId,
        ts: tsBucket,
        subscriber_count: c.subscriberCount,
        video_count: c.videoCount,
        view_count: c.viewCount,
      }
    );
  }
  console.log(`[poller] snapshotted ${channels.length} channels at ${new Date(ts).toISOString()}`);
}

async function tick() {
  try {
    await snapshotTrackedVideos();
    await snapshotTrackedChannels();
  } catch (err) {
    console.error("[poller] tick failed:", err instanceof Error ? err.message : err);
  }
}

console.log(`[poller] starting (interval ${Math.round(intervalMs / 1000)}s)`);
await tick();

const timer = setInterval(tick, intervalMs);
timer.unref?.();

function shutdown() {
  console.log("[poller] shutting down");
  clearInterval(timer);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
