"use client";

import { useState } from "react";

interface TrendingChannelCardProps {
  channel: {
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
    niche?: string;
    videoFormat?: string;
  };
  nicheRpm?: { min: number; max: number; avg: number };
  onAnalyze: (channelId: string) => void;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function formatEarnings(rpm: { min: number; max: number; avg: number }, views: number): string {
  const per1k = views / 1000;
  const minEarn = Math.round(per1k * rpm.min);
  const maxEarn = Math.round(per1k * rpm.max);
  if (minEarn >= 1000) return `$${(minEarn / 1000).toFixed(1)}K-$${(maxEarn / 1000).toFixed(1)}K`;
  return `$${minEarn}-$${maxEarn}`;
}

function getViralScoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";
}

function getViralScoreLabel(score: number): string {
  if (score >= 70) return "S-Tier";
  if (score >= 50) return "A-Tier";
  if (score >= 30) return "B-Tier";
  return "C-Tier";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function TrendingChannelCard({ channel, nicheRpm, onAnalyze }: TrendingChannelCardProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = channel.thumbnailUrl && !imgError;

  return (
    <div className="group rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600">
      <div className="flex items-start gap-3">
        {showImage ? (
          <img
            src={channel.thumbnailUrl}
            alt={channel.title}
            className="h-12 w-12 rounded-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-700 text-sm font-bold text-white">
            {getInitials(channel.title)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-zinc-900 dark:text-white">
            {channel.title}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {channel.categoryName}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-zinc-900 dark:text-white">
            {formatNumber(channel.subscriberCount)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Subs</p>
        </div>
        <div>
          <p className="text-lg font-bold text-zinc-900 dark:text-white">
            {formatNumber(channel.viewCount)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Views</p>
        </div>
        <div>
          <p className="text-lg font-bold text-zinc-900 dark:text-white">
            {channel.videoCount}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Videos</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${getViralScoreColor(
            channel.viralScore
          )}`}
        >
          {getViralScoreLabel(channel.viralScore)} {channel.viralScore}
        </span>
        {channel.isNewlyCreated && (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            New
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p
          className={`text-sm font-medium ${
            channel.growthRate >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {channel.growthRate >= 0 ? "+" : ""}
          {channel.growthRate.toFixed(1)}% growth
        </p>
        <p className="text-xs text-zinc-500">
          {channel.viewSubRatio.toFixed(1)}x V/S
        </p>
      </div>

      {nicheRpm && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 dark:bg-green-900/20">
          <span className="text-xs">💰</span>
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">
            Est. {formatEarnings(nicheRpm, channel.viewCount)}/total
          </span>
          <span className="text-[10px] text-green-600/70 dark:text-green-400/60">
            (RPM ${nicheRpm.avg})
          </span>
        </div>
      )}

      <button
        onClick={() => onAnalyze(channel.channelId)}
        className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
      >
        Create Similar Channel
      </button>
    </div>
  );
}
