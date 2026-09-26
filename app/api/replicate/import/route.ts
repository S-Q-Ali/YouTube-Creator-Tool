import { NextRequest, NextResponse } from "next/server";
import { importSourceVideo, listLibraryAssets } from "@/lib/mediaScraper";

export async function GET(req: NextRequest) {
  try {
    const niche = req.nextUrl.searchParams.get("niche") ?? "";
    if (!niche) return NextResponse.json({ error: "niche is required" }, { status: 400 });
    return NextResponse.json({ assets: listLibraryAssets(niche) });
  } catch (error) {
    console.error("Failed to list library assets:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, niche, filename } = body;
    if (!url || !niche) {
      return NextResponse.json({ error: "url and niche are required" }, { status: 400 });
    }
    const res = await importSourceVideo(url as string, { niche, filename });
    return NextResponse.json({ success: res.ok, ...res }, { status: res.ok ? 200 : 400 });
  } catch (error) {
    console.error("Failed to import source video:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import" },
      { status: 500 }
    );
  }
}