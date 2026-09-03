import { NextRequest, NextResponse } from "next/server";
import { generateThumbnail } from "@/lib/thumbnailGenerator";

export async function POST(req: NextRequest) {
  try {
    const { title, style, niche } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const result = await generateThumbnail({ title, style, niche });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imageData: result.imageData,
      revisedPrompt: result.revisedPrompt,
    });
  } catch (error) {
    console.error("Thumbnail generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate thumbnail" },
      { status: 500 }
    );
  }
}
