import { computeSeoScore, scoreLabel } from "./scorecard";
import { computeVelocity, isSpike } from "./velocity";
import { outlierPercent } from "./outlier";
import type { VideoInfo } from "./types";

/**
 * The lean row a grid cell paints: the readings a card shows without hovering,
 * and nothing the cell does not display. Built from data the server already
 * holds, so scoring a page of cards costs no extra YouTube quota.
 */
export interface GridRow {
  id: string;
  viewCount: number;
  likeCount: number | null;
  durationSeconds: number | null;
  publishedAt: string;
  thumbnailUrl: string;
  velocity: { vph: number | null; vphDay: number | null; ageHours: number };
  score: number;
  grade: ReturnType<typeof scoreLabel>;
  spike: boolean;
  /** Reach of the channel this video belongs to; absent until the channel round-trip lands. */
  subscribers: number | null;
  /** Percent of the channel's usual video, e.g. 340 for 3.4x. */
  outlier: number | null;
}

export interface GridChannelContext {
  subscriberCount: number | null;
  /** Channel lifetime views over its video count, from lib/outlier. */
  averageViews: number | null;
}

export function buildGridRow(
  video: VideoInfo,
  now?: number,
  channel?: GridChannelContext | null
): GridRow {
  const velocity = computeVelocity({
    viewCount: video.viewCount,
    publishedAt: video.publishedAt,
    now
  });
  const score = computeSeoScore({
    title: video.title,
    description: video.description,
    tags: video.tags,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    publishedAt: video.publishedAt
  }).total;

  return {
    id: video.videoId,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    durationSeconds: video.durationSeconds > 0 ? video.durationSeconds : null,
    publishedAt: video.publishedAt,
    thumbnailUrl: video.thumbnailUrl,
    velocity,
    score,
    grade: scoreLabel(score),
    spike: isSpike(velocity.vph),
    subscribers:
      channel && channel.subscriberCount != null && channel.subscriberCount > 0 ? channel.subscriberCount : null,
    outlier: channel ? outlierPercent(video.viewCount, channel.averageViews) : null
  };
}
