import { NextRequest, NextResponse } from "next/server";
import { getTrendingChannels, getTrendingChannelCount, getDiscoveryStatus } from "@/lib/trendingEngine";
import { getQuotaStatus } from "@/lib/youtubeClient";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "all";
  const niche = searchParams.get("niche") || "all";
  const aiOnly = searchParams.get("aiOnly") === "true";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  const channels = getTrendingChannels(format, niche, limit, offset, aiOnly);
  const total = getTrendingChannelCount(format, niche, aiOnly);
  const quota = getQuotaStatus();
  const discoveryStatus = getDiscoveryStatus();

  return NextResponse.json({
    channels,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    quota,
    discoveryStatus,
  });
}
