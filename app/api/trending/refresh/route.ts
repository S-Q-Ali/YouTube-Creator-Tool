import { NextRequest, NextResponse } from "next/server";
import { refreshAllTrending } from "@/lib/trendingEngine";
import { getQuotaStatus } from "@/lib/youtubeClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const format = body.format || undefined;
    const niche = body.niche || undefined;

    const quota = getQuotaStatus();
    if (quota.data.remaining <= 0) {
      return NextResponse.json({
        success: false,
        error: "Data API quota exhausted. Resets at midnight Pacific Time.",
        quota,
      }, { status: 429 });
    }

    let result;
    try {
      result = await refreshAllTrending(format, niche);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.toLowerCase().includes("quota");
      const updatedQuota = getQuotaStatus();
      return NextResponse.json({
        success: false,
        error: isQuota ? "Daily API quota exhausted. Resets at midnight Pacific Time." : msg,
        quota: updatedQuota,
      }, { status: isQuota ? 429 : 500 });
    }

    const updatedQuota = getQuotaStatus();
    return NextResponse.json({
      success: true,
      discovered: result.discovered,
      niches: result.niches,
      searchesUsed: result.searchesUsed,
      quota: updatedQuota,
      message: `Discovered ${result.discovered} channels across ${result.niches} niches (${result.searchesUsed} searches used)`,
    });
  } catch (error) {
    console.error("Trending refresh failed:", error);
    const quota = getQuotaStatus();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Refresh failed",
        quota,
      },
      { status: 500 }
    );
  }
}
