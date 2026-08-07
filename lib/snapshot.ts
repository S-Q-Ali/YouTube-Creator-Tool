import { all, now, run } from "./db";
import { fetchVideos, fetchChannels } from "./youtubeClient";
import { rankKeyword } from "./keywordEngine";

/** Snapshot all tracked videos into video_snapshots (10-min dedupe bucket). */
export async function snapshotTrackedVideos(): Promise<number> {
  const tracked = all<{ ref_id: string }>("SELECT ref_id FROM tracked_items WHERE kind = 'video'");
  if (tracked.length === 0) return 0;
  const videos = await fetchVideos(tracked.map((t) => t.ref_id));
  const ts = now();
  const tsBucket = Math.floor(ts / 600000) * 600000;
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
  return videos.length;
}

/** Snapshot all tracked channels into channel_snapshots (10-min dedupe bucket). */
export async function snapshotTrackedChannels(): Promise<number> {
  const tracked = all<{ ref_id: string }>("SELECT ref_id FROM tracked_items WHERE kind = 'channel'");
  if (tracked.length === 0) return 0;
  const channels = await fetchChannels(tracked.map((t) => t.ref_id));
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
  return channels.length;
}

/**
 * Re-rank tracked keywords so their snapshots trend. rankKeyword is cached 24h,
 * so this only spends search.list quota when a term's ranking is stale.
 */
export async function snapshotTrackedKeywords(): Promise<number> {
  const tracked = all<{ ref_id: string }>("SELECT ref_id FROM tracked_items WHERE kind = 'keyword'");
  let ranked = 0;
  for (const t of tracked) {
    try {
      const res = await rankKeyword(t.ref_id);
      if (res) ranked++;
    } catch (err) {
      console.error(`[snapshot] keyword re-rank failed for "${t.ref_id}":`, err instanceof Error ? err.message : err);
    }
  }
  return ranked;
}

/** Run every snapshot routine; returns a summary. Used by the poller and the refresh endpoint. */
export async function runAllSnapshots(): Promise<{ videos: number; channels: number; keywords: number }> {
  const [videos, channels, keywords] = await Promise.allSettled([
    snapshotTrackedVideos(),
    snapshotTrackedChannels(),
    snapshotTrackedKeywords(),
  ]);
  return {
    videos: videos.status === "fulfilled" ? videos.value : 0,
    channels: channels.status === "fulfilled" ? channels.value : 0,
    keywords: keywords.status === "fulfilled" ? keywords.value : 0,
  };
}
