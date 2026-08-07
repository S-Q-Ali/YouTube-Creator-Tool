import { getQuotaStatus } from "@/lib/youtubeClient";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, quota: getQuotaStatus() });
}
