"use client";

import { useState, useEffect } from "react";
import { FormatDropdown } from "./FormatDropdown";
import { CategoryDropdown } from "./CategoryDropdown";
import { TrendingChannelCard } from "./TrendingChannelCard";
import { AnalysisModal } from "./AnalysisModal";
import { FORMAT_NICHES } from "@/lib/niches";

interface TrendingChannel {
  channelId: string;
  title: string;
  thumbnailUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  viralScore: number;
  growthRate: number;
  isNewlyCreated: boolean;
  categoryName: string;
  viewSubRatio: number;
  videoFormat: string;
  niche: string;
}

interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface DiscoveryInfo {
  videoFormat: string;
  niche: string;
  lastDiscoveredAt: number;
  channelsFound: number;
}

interface TrendingChannelsGridProps {
  initialChannels?: TrendingChannel[];
}

function getNicheRpm(videoFormat: string, nicheId: string): { min: number; max: number; avg: number } | undefined {
  const niches = FORMAT_NICHES[videoFormat] || [];
  const niche = niches.find((n) => n.id === nicheId);
  return niche?.rpm;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function TrendingChannelsGrid({
  initialChannels = [],
}: TrendingChannelsGridProps) {
  const [channels, setChannels] = useState<TrendingChannel[]>(initialChannels);
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryInfo[]>([]);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const fetchChannels = async (format: string, niche: string, pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format,
        niche,
        page: String(pageNum),
        limit: "20",
      });
      const res = await fetch(`/api/trending?${params}`);
      const data = await res.json();
      setChannels(data.channels || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
      if (data.quota) setQuota(data.quota.search);
      if (data.discoveryStatus) setDiscoveryStatus(data.discoveryStatus);
    } catch (error) {
      console.error("Failed to fetch trending channels:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels(selectedFormat, selectedNiche, page);
  }, [selectedFormat, selectedNiche, page]);

  const handleFormatChange = (format: string) => {
    setSelectedFormat(format);
    setSelectedNiche("all");
    setPage(1);
  };

  const handleNicheChange = (niche: string) => {
    setSelectedNiche(niche);
    setPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch("/api/trending/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: selectedFormat, niche: selectedNiche }),
      });
      const data = await res.json();
      if (data.success) {
        setRefreshMessage(data.message);
        if (data.quota) setQuota(data.quota.search);
      } else {
        setRefreshMessage(data.error || "Refresh failed");
      }
      await fetchChannels(selectedFormat, selectedNiche, page);
    } catch (error) {
      console.error("Refresh failed:", error);
      setRefreshMessage("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAnalyze = (channelId: string) => {
    setSelectedChannelId(channelId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedChannelId(null);
  };

  const currentNicheStatus = discoveryStatus.find(
    (d) => d.videoFormat === selectedFormat && d.niche === selectedNiche
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Trending Channels
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {total} channels discovered • Top 20 by viral score
          </p>
        </div>

        <div className="flex items-center gap-3">
          <FormatDropdown
            selected={selectedFormat}
            onSelect={handleFormatChange}
          />

          <CategoryDropdown
            format={selectedFormat}
            selected={selectedNiche}
            onSelect={handleNicheChange}
          />

          <button
            onClick={handleRefresh}
            disabled={refreshing || (quota !== null && quota.remaining <= 5)}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? "Discovering..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Quota and Discovery Status Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        {quota && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Search Quota:</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className={`h-full rounded-full ${
                  quota.remaining <= 10 ? "bg-red-500" : quota.remaining <= 30 ? "bg-yellow-500" : "bg-green-500"
                }`}
                style={{ width: `${((quota.limit - quota.remaining) / quota.limit) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {quota.remaining}/{quota.limit} remaining
            </span>
          </div>
        )}

        {currentNicheStatus && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Last discovered:</span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {formatTimeAgo(currentNicheStatus.lastDiscoveredAt)} ({currentNicheStatus.channelsFound} channels)
            </span>
          </div>
        )}

        {refreshMessage && (
          <span className={`text-xs font-medium ${
            refreshMessage.includes("exhausted") || refreshMessage.includes("failed")
              ? "text-red-600 dark:text-red-400"
              : "text-green-600 dark:text-green-400"
          }`}>
            {refreshMessage}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600"></div>
            <p className="mt-4 text-sm text-zinc-500">Loading channels...</p>
          </div>
        </div>
      ) : channels.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="mt-4 text-sm text-zinc-500">No trending channels found</p>
            <button
              onClick={handleRefresh}
              disabled={quota !== null && quota.remaining <= 5}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Discover Channels
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channels.map((channel) => (
              <TrendingChannelCard
                key={channel.channelId}
                channel={channel}
                nicheRpm={getNicheRpm(channel.videoFormat, channel.niche)}
                onAnalyze={handleAnalyze}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Analysis Modal */}
      {modalOpen && selectedChannelId && (
        <AnalysisModal
          channelId={selectedChannelId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
