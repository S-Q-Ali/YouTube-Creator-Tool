import { NextResponse } from "next/server";
import { checkFfmpeg, checkFfprobe } from "@/lib/ffmpeg";
import { detectVoiceStudio } from "@/lib/tts";
import { config } from "@/lib/config";

export async function GET() {
  try {
    const [ffmpeg, ffprobe, voiceStudio] = await Promise.all([
      checkFfmpeg(),
      checkFfprobe(),
      detectVoiceStudio(),
    ]);
    return NextResponse.json({
      ffmpeg,
      ffprobe,
      voiceStudio,
      assets: {
        mediaDir: config.mediaDir,
        rendersDir: config.rendersDir,
      },
    });
  } catch (error) {
    console.error("Failed to check replication status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}