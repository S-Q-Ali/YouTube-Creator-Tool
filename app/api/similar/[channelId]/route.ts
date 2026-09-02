import { NextRequest, NextResponse } from "next/server";
import { fetchChannels } from "@/lib/youtubeClient";
import { getAnalysis, isAnalyzed } from "@/lib/aiAnalysis";
import { getTrendingChannelById } from "@/lib/trendingEngine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const channels = await fetchChannels([channelId]);
  if (channels.length === 0) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const channel = channels[0];
  const trending = getTrendingChannelById(channelId);
  const analyzed = isAnalyzed(channelId);
  const analysis = analyzed ? getAnalysis(channelId) : null;

  return NextResponse.json({
    channel: {
      channelId: channel.channelId,
      title: channel.title,
      description: channel.description,
      thumbnailUrl: channel.thumbnailUrl,
      subscriberCount: channel.subscriberCount,
      viewCount: channel.viewCount,
      videoCount: channel.videoCount,
      publishedAt: channel.publishedAt,
      country: channel.country,
      topicCategories: channel.topicCategories,
      channelTags: channel.channelTags,
    },
    trending: trending
      ? {
          viralScore: trending.viralScore,
          growthRate: trending.growthRate,
          viewSubRatio: trending.viewSubRatio,
          isNewlyCreated: trending.isNewlyCreated,
          categoryName: trending.categoryName,
        }
      : null,
    analyzed,
    analysis,
  });
}
