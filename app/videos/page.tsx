import ScorecardLookup from "@/components/ScorecardLookup";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Video &amp; Channel Scorecard</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Paste any YouTube video or channel URL to get a vidIQ-style audit. The score is 50% on-page
        SEO (title, description, tags, keyword usage) and 50% audience performance (engagement + 24h
        view velocity). Track items to begin collecting snapshot history for VPH trends.
      </p>
      <ScorecardLookup />
    </div>
  );
}
