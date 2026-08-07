import { getOwnAudit } from "@/lib/ownanalytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const audit = await getOwnAudit();
  return Response.json(audit);
}