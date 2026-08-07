import { getCompetitorDashboard } from "@/lib/competitorEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ dashboard: getCompetitorDashboard() });
}
