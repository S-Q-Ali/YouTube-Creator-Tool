"use client";

import { useState } from "react";
import Link from "next/link";
import { CompetitionBadge, ScoreBadge } from "./ScoreBadge";

interface KeywordResult {
  term: string;
  displayTerm: string;
  demandScore: number;
  competitionScore: number;
  competitionLabel: string;
  overallScore: number;
  source: string;
  scored: boolean;
}

interface ResearchOutput {
  seed: string;
  results: KeywordResult[];
  relatedCount: number;
  matchingTerms: string[];
  questions: string[];
  ranked: number;
  truncated: boolean;
}

export default function KeywordResearch() {
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResearchOutput | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    const s = seed.trim();
    if (!s || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/keywords/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: s, rankTop: 5 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Research failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="e.g. keto diet, minecraft, python tutorial…"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={loading || !seed.trim()}
          className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Researching…" : "Research"}
        </button>
      </form>
      {loading && (
        <p className="mt-3 text-sm text-zinc-500">
          Expanding keywords via YouTube autocomplete, then scoring top candidates against search results…
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {data && !loading && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-zinc-500">
            <strong className="text-zinc-900 dark:text-zinc-100">{data.relatedCount}</strong> related keywords for{" "}
            <strong className="text-zinc-900 dark:text-zinc-100">“{data.seed}”</strong>
            {data.ranked > 0 && <> · competition scored for top {data.ranked}</>}
            {data.truncated && " · truncated"}
          </p>

          {(data.matchingTerms.length > 0 || data.questions.length > 0) && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {data.matchingTerms.length > 0 && (
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Matching terms</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.matchingTerms.map((t) => (
                      <Link key={t} href={`/keywords/${encodeURIComponent(t)}`} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                        {t}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {data.questions.length > 0 && (
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Questions</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.questions.map((t) => (
                      <Link key={t} href={`/keywords/${encodeURIComponent(t)}`} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                        {t}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-2.5 font-semibold">Keyword</th>
                  <th className="px-4 py-2.5 font-semibold">Demand</th>
                  <th className="px-4 py-2.5 font-semibold">Competition</th>
                  <th className="px-4 py-2.5 font-semibold">Overall</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => (
                  <tr key={r.term} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/60">
                    <td className="max-w-[280px] truncate px-4 py-2.5 font-medium">
                      <Link href={`/keywords/${encodeURIComponent(r.term)}`} className="hover:text-red-600 hover:underline dark:hover:text-red-400">
                        {r.displayTerm}
                      </Link>
                      {!r.scored && (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          est.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><ScoreBadge score={r.demandScore} size="sm" /></td>
                    <td className="px-4 py-2.5"><CompetitionBadge label={r.competitionLabel} /></td>
                    <td className="px-4 py-2.5"><ScoreBadge score={r.overallScore} size="sm" /></td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/keywords/${encodeURIComponent(r.term)}`} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
