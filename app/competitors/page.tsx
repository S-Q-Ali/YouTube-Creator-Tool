import { getCompetitorDashboard } from "@/lib/competitorEngine";
import CompetitorsView from "@/components/CompetitorsView";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage() {
  const dashboard = getCompetitorDashboard();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Competitor Tracking</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Watch your rivals’ videos, channels, and keyword rankings. The poller snapshots
        your watchlist hourly so you can see view velocity (VPH), subscriber growth, and
        score changes over time.
      </p>
      <CompetitorsView dashboard={dashboard} />
    </div>
  );
}
