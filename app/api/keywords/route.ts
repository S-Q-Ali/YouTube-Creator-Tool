import type { NextRequest } from "next/server";
import { getCachedKeywords } from "@/lib/keywordEngine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  return Response.json({ keywords: getCachedKeywords(q, limit) });
}
