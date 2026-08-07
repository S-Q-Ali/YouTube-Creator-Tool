import { getSetting } from "@/lib/db";
import { config } from "@/lib/config";
import { getQuotaStatus } from "@/lib/youtubeClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbVersion = getSetting("schema_version") ?? "ok";
  return Response.json({
    ok: true,
    dbVersion,
    apiKeyConfigured: Boolean(config.youtubeApiKey),
    quota: getQuotaStatus(),
  });
}
