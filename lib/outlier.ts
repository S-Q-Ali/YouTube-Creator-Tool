/**
 * How far a video sits from the track record of the channel that made it.
 *
 * The only other baseline this project has is the average of the other videos
 * we happen to have stored for a channel, and that is null for every channel
 * nobody tracked. Channel statistics answer the same question for any channel
 * on a page: lifetime views spread over the number of videos uploaded.
 */
export interface ChannelReach {
  viewCount: number | null;
  videoCount: number | null;
}

/** Fewer videos than this and the "average" is one or two uploads, not a habit. */
export const MIN_USABLE_VIDEOS = 3;

export function channelAverageViews(channel: ChannelReach | null | undefined): number | null {
  if (!channel) return null;
  const views = channel.viewCount ?? 0;
  const videos = channel.videoCount ?? 0;
  if (!isFinite(views) || !isFinite(videos)) return null;
  if (views <= 0 || videos < MIN_USABLE_VIDEOS) return null;
  return views / videos;
}

export function outlierPercent(
  viewCount: number | null | undefined,
  averageViews: number | null | undefined
): number | null {
  if (viewCount == null || averageViews == null) return null;
  if (!isFinite(viewCount) || !isFinite(averageViews)) return null;
  if (!(viewCount > 0) || !(averageViews > 0)) return null;
  return Math.round((viewCount / averageViews) * 100);
}
