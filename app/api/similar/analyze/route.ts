import { NextRequest, NextResponse } from "next/server";
import { fetchChannels, fetchChannelUploadIds, fetchVideos } from "@/lib/youtubeClient";
import { analyzeChannel, saveAnalysis } from "@/lib/aiAnalysis";
import { getTrendingChannelById } from "@/lib/trendingEngine";

export async function POST(req: NextRequest) {
  try {
    const { channelId } = await req.json();

    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const channels = await fetchChannels([channelId]);
    if (channels.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = channels[0];

    const videoIds = await fetchChannelUploadIds(channelId, 20);
    const videos = await fetchVideos(videoIds);

    const analysis = await analyzeChannel(channel, videos);

    saveAnalysis(channelId, analysis);

    return NextResponse.json({
      success: true,
      channelId,
      channelName: channel.title,
      message: "Analysis complete",
    });
  } catch (error) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
