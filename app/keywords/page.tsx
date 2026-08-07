import type { KeywordRow } from "@/lib/types";
import KeywordResearch from "@/components/KeywordResearch";
import { getCachedKeywords } from "@/lib/keywordEngine";
import { CompetitionBadge, ScoreBadge } from "@/components/ScoreBadge";
import Link from "next/link";

export const dynamic = "force-dynamic";

function KeywordTable({ keywords, empty }: { keywords: KeywordRow[]; empty: string }) {
  if (keywords.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <th className="px-4 py-2.5 font-semibold">Keyword</th>
            <th className="px-4 py-2.5 font-semibold">Demand</th>
            <th className="px-4 py-2.5 font-semibold">Competition</th>
            <th className="px-4 py-2.5 font-semibold">Overall</th>
            <th className="px-4 py-2.5 font-semibold text-right">Last checked</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((k) => (
            <tr key={k.term} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/60">
              <td className="max-w-[300px] truncate px-4 py-2.5 font-medium">
                <Link href={`/keywords/${encodeURIComponent(k.term)}`} className="hover:text-red-600 hover:underline dark:hover:text-red-400">
                  {k.displayTerm}
                </Link>
              </td>
              <td className="px-4 py-2.5"><ScoreBadge score={k.demandScore} size="sm" /></td>
              <td className="px-4 py-2.5"><CompetitionBadge label={k.competitionLabel} /></td>
              <td className="px-4 py-2.5"><ScoreBadge score={k.score} size="sm" /></td>
              <td className="px-4 py-2.5 text-right text-xs text-zinc-500">
                {new Date(k.lastChecked).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function KeywordsPage() {
  const cached = getCachedKeywords(undefined, 100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Keyword Research</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Enter a topic. Niche-Scope expands it through YouTube autocomplete (a–z + question words),
        estimates demand from suggestion ordering, and scores competition for the top candidates against live search results.
      </p>
      <KeywordResearch />
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Recently researched</h2>
        <KeywordTable keywords={cached} empty="No keywords researched yet. Try one above." />
      </section>
    </div>
  );
}
