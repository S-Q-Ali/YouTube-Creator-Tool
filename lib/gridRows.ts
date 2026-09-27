import { computeSeoScore, scoreLabel } from "./scorecard";
import { computeVelocity, isSpike } from "./velocity";
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
  velocity: { vph: number | null; vphDay: number | null; ageHours: number };
  score: number;
  grade: ReturnType<typeof scoreLabel>;
  spike: boolean;
}

export function buildGridRow(video: VideoInfo, now?: number): GridRow {
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
    velocity,
    score,
    grade: scoreLabel(score),
    spike: isSpike(velocity.vph)
  };
}
