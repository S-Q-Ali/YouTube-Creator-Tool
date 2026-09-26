import { NextRequest, NextResponse } from "next/server";
import { listReplicationRuns, createReplicationRun, runReplication } from "@/lib/replicationEngine";

export async function GET() {
  try {
    const runs = listReplicationRuns(50);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Failed to list replication runs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelId, channelTitle, scriptId, niche, videoFormat, voice, runTitle } = body;

    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 });
    }

    const input = {
      channelId: (channelId as string) || "",
      channelTitle: (channelTitle as string) || "",
      scriptId: Number(scriptId),
      niche: (niche as string) || "",
      videoFormat: (videoFormat as "longform" | "shortform") || "longform",
      voice: (voice as string) || "",
      runTitle: (runTitle as string) || "",
    };

    const run = createReplicationRun(input);
    // Fire the pipeline without blocking the HTTP response; the client polls the run.
    void runReplication(run.id).catch((err) => {
      console.error(`Replication run ${run.id} failed:`, err);
    });
    return NextResponse.json({ success: true, run }, { status: 202 });
  } catch (error) {
    console.error("Failed to start replication run:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start" },
      { status: 500 }
    );
  }
}