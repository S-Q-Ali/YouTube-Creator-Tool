"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface ChannelData {
  channel: {
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
    publishedAt: string;
    country: string;
    topicCategories: string[];
    channelTags: string[];
  };
  trending: {
    viralScore: number;
    growthRate: number;
    viewSubRatio: number;
    isNewlyCreated: boolean;
    categoryName: string;
  } | null;
  analyzed: boolean;
  analysis: {
    strategy: {
      contentType: string[];
      postingSchedule: string;
      thumbnailStyle: string;
      titleFormula: string;
      tagStrategy: string[];
      uniqueSellingPoints: string[];
    } | null;
    contentIdeas: Array<{
      title: string;
      description: string;
      contentType: string;
      estimatedViews: string;
      difficulty: string;
    }>;
    scripts: Array<{
      title: string;
      hook: string;
      intro: string;
      bodySections: string[];
      outro: string;
      estimatedDuration: number;
    }>;
    growthBlueprint: {
      "30day": { goals: string[]; actions: string[]; metrics: string[] };
      "60day": { goals: string[]; actions: string[]; metrics: string[] };
      "90day": { goals: string[]; actions: string[]; metrics: string[] };
    } | null;
  } | null;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function getDifficultyColor(d: string): string {
  if (d === "easy") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (d === "medium") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function getViewsColor(v: string): string {
  if (v === "high") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (v === "medium") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";
}

export default function SimilarChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"strategy" | "ideas" | "scripts" | "blueprint">("strategy");

  useEffect(() => {
    fetchChannelData();
  }, [channelId]);

  const fetchChannelData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/similar/${channelId}`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("Failed to fetch channel:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/similar/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const result = await res.json();
      if (result.success) {
        await fetchChannelData();
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600"></div>
            <p className="mt-4 text-sm text-zinc-500">Loading channel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-center">
          <p className="text-zinc-500">Channel not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { channel, trending, analyzed, analysis } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-start gap-4">
          <img
            src={channel.thumbnailUrl || "/placeholder.png"}
            alt={channel.title}
            className="h-20 w-20 rounded-full object-cover"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{channel.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{channel.country || "Unknown"} • {trending?.categoryName || "Unknown Category"}</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{channel.description}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-700">
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatNumber(channel.subscriberCount)}</p>
            <p className="text-xs text-zinc-500">Subscribers</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-700">
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{formatNumber(channel.viewCount)}</p>
            <p className="text-xs text-zinc-500">Total Views</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-700">
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{channel.videoCount}</p>
            <p className="text-xs text-zinc-500">Videos</p>
          </div>
          {trending && (
            <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-700">
              <p className="text-xl font-bold text-red-600">{trending.viralScore}</p>
              <p className="text-xs text-zinc-500">Viral Score</p>
            </div>
          )}
        </div>

        {trending && (
          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm text-green-600 font-medium">
              +{trending.growthRate.toFixed(1)}% growth (30d)
            </span>
            <span className="text-sm text-zinc-500">
              {trending.viewSubRatio.toFixed(1)}x View/Sub Ratio
            </span>
            {trending.isNewlyCreated && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Newly Created
              </span>
            )}
          </div>
        )}
      </div>

      {!analyzed ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">Ready to Analyze</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Click the button below to generate AI-powered strategy, content ideas, scripts, and growth blueprint.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="mt-6 rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {analyzing ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Analyzing with AI...
              </span>
            ) : (
              "Create Similar Channel"
            )}
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex gap-2 overflow-x-auto border-b border-zinc-200 pb-2 dark:border-zinc-700">
            {(["strategy", "ideas", "scripts", "blueprint"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-red-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                }`}
              >
                {tab === "strategy" && "Strategy"}
                {tab === "ideas" && `Content Ideas (${analysis?.contentIdeas?.length || 0})`}
                {tab === "scripts" && `Scripts (${analysis?.scripts?.length || 0})`}
                {tab === "blueprint" && "Growth Blueprint"}
              </button>
            ))}
          </div>

          {activeTab === "strategy" && analysis?.strategy && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
                <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Content Strategy</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-500">Content Types</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {analysis.strategy.contentType.map((type, i) => (
                        <span key={i} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-500">Posting Schedule</p>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{analysis.strategy.postingSchedule}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-500">Thumbnail Style</p>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{analysis.strategy.thumbnailStyle}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-500">Title Formula</p>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{analysis.strategy.titleFormula}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-zinc-500">Tag Strategy</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {analysis.strategy.tagStrategy.map((tag, i) => (
                      <span key={i} className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-zinc-500">Unique Selling Points</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                    {analysis.strategy.uniqueSellingPoints.map((usp, i) => (
                      <li key={i}>{usp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ideas" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analysis?.contentIdeas?.map((idea, i) => (
                <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                  <h4 className="font-semibold text-zinc-900 dark:text-white">{idea.title}</h4>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{idea.description}</p>
                  <div className="mt-3 flex gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor(idea.difficulty)}`}>
                      {idea.difficulty}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getViewsColor(idea.estimatedViews)}`}>
                      {idea.estimatedViews} views
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {idea.contentType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "scripts" && (
            <div className="space-y-6">
              {analysis?.scripts?.map((script, i) => (
                <div key={i} className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-zinc-900 dark:text-white">{script.title}</h4>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {Math.floor(script.estimatedDuration / 60)}:{String(script.estimatedDuration % 60).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Hook</p>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{script.hook}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Intro</p>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{script.intro}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Body</p>
                      {script.bodySections.map((section, j) => (
                        <p key={j} className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{section}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Outro</p>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{script.outro}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "blueprint" && analysis?.growthBlueprint && (
            <div className="grid gap-6 md:grid-cols-3">
              {(["30day", "60day", "90day"] as const).map((phase) => {
                const blueprint = analysis.growthBlueprint![phase];
                return (
                <div key={phase} className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
                  <h4 className="font-semibold text-zinc-900 dark:text-white">
                    {phase === "30day" ? "30-Day" : phase === "60day" ? "60-Day" : "90-Day"} Plan
                  </h4>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Goals</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                        {blueprint.goals.map((goal, i) => (
                          <li key={i}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Actions</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                        {blueprint.actions.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Metrics</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                        {blueprint.metrics.map((metric, i) => (
                          <li key={i}>{metric}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
