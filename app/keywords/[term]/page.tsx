import { notFound } from "next/navigation";
import { getKeyword, getKeywordSnapshots, getRankedVideos, decodeTerm } from "@/lib/keywordEngine";
import { CompetitionBadge, ScoreBadge } from "@/components/ScoreBadge";
import Sparkline from "@/components/Sparkline";
import RerankButton from "@/components/RerankButton";

export const dynamic = "force-dynamic";

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function KeywordPage(props: PageProps<"/keywords/[term]">) {
  const { term: raw } = await props.params;
  const term = decodeTerm(raw);
  const keyword = getKeyword(term);
  if (!keyword) notFound();

  const snapshots = getKeywordSnapshots(term);
  const rankedVideos = getRankedVideos(term);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Keyword</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{keyword.displayTerm}</h1>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Overall score</p>
          <div className="mt-2"><ScoreBadge score={keyword.score} size="lg" /></div>
          <p className="mt-2 text-xs text-zinc-500">demand × (100 − competition)</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Demand (est.)</p>
          <div className="mt-2"><ScoreBadge score={keyword.demandScore} size="lg" /></div>
          <p className="mt-2 text-xs text-zinc-500">from YouTube autocomplete ordering</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Competition</p>
          <div className="mt-2"><CompetitionBadge label={keyword.competitionLabel} /> <span className="ml-2 text-sm font-medium">{keyword.competitionScore}</span></div>
          <p className="mt-2 text-xs text-zinc-500">from live search result strength</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Score history</h2>
          <RerankButton term={term} />
        </div>
        <Sparkline points={snapshots.map((s) => ({ ts: s.ts, value: s.score ?? 0 }))} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ranking videos for “{keyword.displayTerm}”</h2>
        {rankedVideos.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No ranking snapshot yet. Click “Re-rank & refresh” to capture which videos currently rank for this term.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="px-4 py-2.5 font-semibold">Video</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Views</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Likes</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Published</th>
                </tr>
              </thead>
              <tbody>
                {rankedVideos.map((v, i) => (
                  <tr key={v.videoId} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-2.5 font-medium text-zinc-500">{i + 1}</td>
                    <td className="max-w-[360px] truncate px-4 py-2.5">
                      <a
                        href={`https://youtube.com/watch?v=${v.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-red-600 hover:underline dark:hover:text-red-400"
                      >
                        {v.title}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmtViews(v.viewCount)}</td>
                    <td className="px-4 py-2.5 text-right">{v.likeCount != null ? fmtViews(v.likeCount) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-500">{new Date(v.publishedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
