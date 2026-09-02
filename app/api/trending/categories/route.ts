import { NextRequest, NextResponse } from "next/server";
import { VIDEO_FORMATS, FORMAT_NICHES, getFormatNicheCounts } from "@/lib/trendingEngine";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");

  if (format && VIDEO_FORMATS.some(f => f.id === format)) {
    const niches = FORMAT_NICHES[format] || [];
    const counts = getFormatNicheCounts();
    const countMap = new Map(counts.filter(c => c.videoFormat === format).map(c => [c.niche, c.count]));

    return NextResponse.json({
      formats: VIDEO_FORMATS,
      niches: niches.map(n => ({
        id: n.id,
        name: n.name,
        channelCount: countMap.get(n.id) || 0,
      })),
    });
  }

  return NextResponse.json({
    formats: VIDEO_FORMATS,
    niches: [],
  });
}
