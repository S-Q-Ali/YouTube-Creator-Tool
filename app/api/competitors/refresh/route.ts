import { runAllSnapshots } from "@/lib/snapshot";
import { getCompetitorDashboard } from "@/lib/competitorEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const summary = await runAllSnapshots();
  return Response.json({ summary, dashboard: getCompetitorDashboard() });
}
