import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

const allowedRoots = [path.resolve(config.rendersDir), path.resolve(config.dataDir)];

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams.get("path") ?? "";
    if (!p) return NextResponse.json({ error: "path is required" }, { status: 400 });
    const resolved = path.resolve(p);
    if (!allowedRoots.some((root) => resolved === root || resolved.startsWith(root + path.sep))) {
      return NextResponse.json({ error: "path outside allowed directories" }, { status: 403 });
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      return NextResponse.json({ error: "file not found" }, { status: 404 });
    }
    const file = fs.readFileSync(resolved);
    const name = path.basename(resolved);
    const ext = path.extname(name).toLowerCase();
    const type = ext === ".png" || ext === ".jpg" || ext === ".jpeg" ? "image/png" : "video/mp4";
    return new NextResponse(file, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Download failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed" },
      { status: 500 }
    );
  }
}